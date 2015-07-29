/**
 * Dropster 1.4
 *
 * Dropster abstracts and simplifies drag and
 * drop and enables file uploads with AJAX.
 *
 * @version 1.4.2
 * @author Ardalan Samimi
 */
(function($) {
    /**
     * Dropster constructor.
     *
     * @param   string  The element using the plugin
     * @param   object  A collection of settings.
     */
    var Dropster = function (element, options) {
        this.element    = $(element);
        this.inputFile  = false;
        // Set the options
        this.settings   = $.extend({
            url               : false,
            auto              : true,
            uploadLimit       : 0,
            loaderImagePath   : "/node_modules/dropster/lib/loading-128.png",
            extensions        : ["jpg", "jpeg", "gif", "png"],
            monitor           : false,
            onDownload        : function(progressEvent) { },
            onUpload          : function(progressEvent) { },
            onChange          : function(state, status) { },
            onReady           : function(response)      { },
            onError           : function(errorMessage)  { }
        }, options || {});
        // Startup method
        this.onInit();
        // Bind the drag events
        this.bindDragEvents();
    };

    Dropster.prototype = {
        /**
         * initializes public interface property, and
         * sets the file input to auto upload if set.
         *
         */
        onInit: function () {
            // Set the public interface property.
            this.setPublicInterface();
            console.log(this.publicInterface);
            // Bind the input file, if any, to upload
            // automatically when a file is chosen, but
            // only if the auto property is set.
            if (this.settings.auto === true)
                this.setAutoUpload();
        },
        /**
         * Default monitoring function for downloading and
         * getting response from the server. Will be called
         * if not overriden.
         *
         * @param   progressEvent   The progressEvent object from XMLHttpRequest onprogress
         */
        onDownload: function (event) {
            // Calculate the progress and show it.
            var completed = (Math.round((++this.publicInterface.totalSizeLoaded / this.publicInterface.totalSizeToLoad * 1000) / 10));
            this.onProgress("Uploading files... " + completed + "%");
        },
        /**
         * Default monitoring function for uploading to the
         * server, will be called if not overriden.
         *
         * @param   progressEvent   The progressEvent object from XMLHttpRequest upload.onprogress
         */
        onUpload: function (event) {
            // Calculate the progress and show it.
            var completed   = 0;
            if (event.lengthComputable)
                completed = Math.round((event.loaded / event.total * 1000) / 10);
            this.onProgress("Uploading files... " + completed + "%");
        },
        /**
         * Default callback for onreadystatechange
         *
         * @param   state   int
         * @param   status  int
         */
        onChange: function (state, status) {
            if (state === 4 && status === 404)
                this.onError("Error code " + status);
        },
        /**
         * The default ready function called when the upload
         * process is finished, will be called if not overriden.
         *
         * @param   mixed   Response property of an XMLHttpRequest object
         */
        onReady: function (responseText) {
            // Clear the file input, if it exists
            this.resetFileInput();
            if ($("#dropster-window").length < 1)
                this.createWindow(false);
            var divHeader   = $(".dropster-window-header");
            var divBody     = $(".dropster-window-body");
            // Set the new status
            divHeader.html("Upload finish!");
            divBody.children().remove();
            divBody.html("The files have been successfully uploaded.");
        },
        /**
         * Called when encountering error. Can be ovverriden.
         *
         * @param   string  The error message
         */
        onError: function (message) {
            if ($("#dropster-window").length < 1)
                this.createWindow(false);
            var divHeader   = $(".dropster-window-header");
            var divBody     = $(".dropster-window-body");
            // Set the new status
            divHeader.html("Upload error");
            divBody.children().remove();
            divBody.html("An error has occurred: " + message);
        },
        /**
         * Creates a public interface property comprised of
         * the public methods and variables for user access.
         *
         */
        setPublicInterface: function () {
            // The regular expression pattern for an empty function
            var emptyFunction = new RegExp(/(\{\s\})|(\{\})/);
            var publicMethods = {};
            // Loop through the settings variable and
            // check for all the methods defined there.
            for (method in this.settings) {
                if ($.isFunction(this.settings[method])) {
                    var string = this.settings[method].toString();
                    // Empty methods (that is, methods not overriden) should be
                    // replaced by the default method in the public interface,
                    // otherwise, also add a default* method too.
                    if (emptyFunction.test(string)) {
                        if ($.isFunction(this[method]))
                            publicMethods[method] = this[method].bind(this);
                    } else {
                        // Create the defaultMethodName
                        var defaultMethodName = this.createDefaultMethodName(method);
                        publicMethods[method] = this.settings[method];
                        publicMethods[defaultMethodName] = this[method].bind(this);
                    }
                }
            }
            // Set the public interface property, that will hold
            // both the public methods and the public properties.
            this.publicInterface                  = publicMethods;
            this.publicInterface.monitor          = this.settings.monitor;
            this.publicInterface.totalSizeToLoad  = 0;
            this.publicInterface.totalSizeLoaded  = 0;
        },
        /**
         * Binds the file input element, if it exists inside the
         * designated drop area, to automatically upload the file
         * after user has chosen one with the browse button.
         *
         */
        setAutoUpload: function () {
            // Check if the input file exists, bind the element
            // and also add it as a public interface variable.
            var inputFile = this.element.find("input[type='file']");
            if (inputFile.length > 0) {
                var self = this;
                this.inputFile = inputFile;
                this.publicInterface.resetFileInput = this.resetFileInput.bind(this);
                this.inputFile.on("change", function (event) {
                    self.onDrop(event, true, false);
                });
            }
        },
        /**
         * Binds the elements and DOM drag events.
         * Called upon initialization.
         *
         */
        bindDragEvents: function () {
            var self = this;
            var elem = this.element;;
            // Bind the elements drag events
            elem.on("dragenter", function (event) { self.dragEnter(event, elem); });
            elem.on("dragover", function (event) { self.dragOver(event); });
            elem.on("drop", function (event) { self.drop(event, elem); });
            elem.on("dragleave", function (event) { self.dragLeave (event); });
            // Bind the drag events to the DOM, to
            // make sure the highlighting works.
            $(document).on("dragenter", function (event) { self.dragEnter(event); });
            $(document).on("drop", function (event) { self.drop(event); });
            $(document).on("dragover", function (event) { self.dragOver(event, elem); });
        },
        /**
         * Watches for when a dragged object enters
         * a valid drop zone.
         *
         * @param   eventObject
         * @param   Element
         */
        dragEnter: function (event, elem) {
            $('.dropster-highlight').removeClass('dropster-highlight');
            var elem = elem || false;
            if (elem !== false)
                elem.addClass("dropster-highlight");
            this.onDrop(event);
        },
        /**
         * Watches for when an object is being
         * dragged over the valid drop zone. If
         * an element is provided, it will be
         * stripped of the highlighting. This
         * is for when the dragged object leaves
         * the drop target.
         *
         * @param eventObject
         * @param Element
         */
         dragOver: function (event, elem) {
             var elem = elem || false;
             if (elem !== false)
                elem.removeClass("dropster-highlight");
            this.onDrop(event);
         },
        /**
         * Watches for when an object leaves
         * the drop area. If an element is
         * provided, it will be stripped of
         * the highlighting.
         *
         * @param eventObject
         * @param Element
         */
         dragLeave: function (event, elem) {
             var elem = elem || false;
             if (elem !== false)
                elem.removeClass("dropster-highlight");
            this.dragOver(event);
        },
        /**
         * Watches for when a dragged object
         * is dropped on a valid drop zone.
         *
         * @param eventObject
         * @param Element
         */
         drop: function (event, elem) {
             var elem   = elem || false;
             var upload = false;
             var drop = false;
             if (elem !== false) {
                 elem.removeClass("dropster-highlight");
                 upload = true;
                 drop   = true;
             }
             this.onDrop(event, upload, drop);
        },
        /**
         * Determines if the drag/drop was valid
         * and creates a formData object to send
         * to the function sendDrop.
         *
         * @param eventObject   To stop default actions
         * @param        bool   Is upload, yes?
         * @param        bool   Was drop, no?
         */
         onDrop: function (event, upload, drop) {
             var upload = upload || false;
             var drop   = drop || false;
             event.stopPropagation();
             event.preventDefault();
             // Check if an object was dropped on the
             // designated target area or not.
             if (upload === true) {
                 // Sort through the files that were
                 // dropped and add it to the formdata.
                 if (drop == true) {
                    var files = event.originalEvent.dataTransfer.files;
                } else {
                    var files = event.currentTarget.files;
                }

                 var fData  = new FormData();
                 var error  = false;
                 var self   = this;
                 $.each(files, function(x, file) {
                     // If the user has tried uploading files with
                     //  anything other than the allowed extensions
                     // then abort the whole operation.
                     if (self.checkExtension(file.name) === false) {
                         self.publicInterface.onError("Could not upload file " + file.name + ". File extension not allowed.");
                         error = true;
                         return false;
                     } else {
                         // Append files to formdata
                         fData.append('file'+x, file);
                     }
                     // Stop if the limit has been reached
                     if (self.settings.uploadLimit !== 0 &&
                         self.settings.uploadLimit == (x+1))
                         return false;
                 });
                 if (error)
                    return false;
                 // Send the dropped files
                 this.sendDrop(fData, files.length);
             }
         },
         /**
          * Send the files to the server.
          *
          * @param  formData    The data to be sent
          * @param       int    Size of the package
          */
         sendDrop: function (dataPackage, packageSize) {
             // The data package and size is crucial
             var dataPackage = dataPackage || false,
                 packageSize = packageSize || false;
             if (dataPackage === false || packageSize === false)
                return false;

            // Declare self as the object, for scope
            // issues. Also, declare the XMLHttpRequest.
            var self = this;
            var xhr = new XMLHttpRequest();
            self.publicInterface.totalSizeToLoad = packageSize;
            // Set the upload monitoring, either the
            // default or user overriden function.
            xhr.upload.onprogress = function (event) {
                self.publicInterface.onUpload(event);
            }
            // Set the download monitoring, either the
            // default or user overriden function.
            xhr.onprogress = function (event) {
                self.publicInterface.onDownload(event);
            }
            // When the file upload is done, run either
            // the user defined or the default function.
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    console.log(xhr.readyState);
                    console.log(xhr.responseText);
                    self.publicInterface.onReady(xhr.responseText);
                } else {
                    self.publicInterface.onChange(xhr.readyState, xhr.status, xhr.responseText);
                }
            }
            // Make the request, only if an URL is set.
            if (self.settings.url !== false) {
                xhr.open('POST', self.settings.url);
        		xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        		xhr.send(dataPackage);
            } else {
                self.publicInterface.onError("No upload path set");
            }
        },
        /**
         * Check the extension of the file(s) to be uploaded,
         * comparing to the array of file extensions set in
         * the array extensions.
         *
         * @param   string  Name of file
         * @returns   bool
         */
        checkExtension: function (fileName) {
            extension = fileName.split('.').pop().toLowerCase();
            if ($.inArray(extension, this.settings.extensions) != -1)
                return true;
            return false;
        },
        /**
         * Prepends method name with string
         * "default", using camelCase.
         *
         * @param   string  Name to manipulate
         * @returns string
         */
        createDefaultMethodName: function(name) {
            if (/[A-Z]/.test(name.charAt(0)))
                return "default" + name;
            var firstLetter = name.charAt(0);
            return "default" + firstLetter.toUpperCase() + name.substring(1);
        },
        /**
         * Creates a dialog window, for the default progress
         * monitoring event.
         *
         * @param   bool    If a spinner should be shown.
         */
        createWindow: function (withLoaderImage) {
            var withLoaderImage = withLoaderImage || false;
            var div = $("<div>");
            // Create the dialog window
            var divWindow   = div.clone().attr({"id": "dropster-window"});
            var divHeader   = div.clone().attr({"class": "dropster-window-header"}).appendTo(divWindow);
            var divBody     = div.clone().attr({"class": "dropster-window-body"}).appendTo(divWindow);
            var divFooter   = div.clone().attr({"class": "dropster-window-footer"}).appendTo(divWindow);
            var divButton   = div.clone().attr({"class": "dropster-window-button"}).html("OK").appendTo(divFooter);
            // Bind the button
            divButton.on("click", function() {
                $("#dropster-window").remove();
            });
            // Adds a spinner image
            if (withLoaderImage)
                var imgElement  = $("<img>").attr({"src": this.settings.loaderImagePath}).appendTo(divBody);
            // Show the window
            divWindow.appendTo("body");
        },
        /**
         * Outputs the progress.
         *
         * @param   string  The output string
         */
        onProgress: function (progress) {
            if ($("#dropster-window").length < 1)
                this.createWindow(true);
            // Find the header and show the progress
            $(".dropster-window-header").html(progress);
        },
        /**
         * Resets the file input
         *
         */
        resetFileInput: function () {
            if (this.inputFile !== false) {
                this.inputFile.val("");
            }
        },
        /**
         * Update Dropster settings
         *
         * @param   object  Collection of settings
         */
        updateSettings: function (options) {
            this.settings = $.extend(this.settings, options);
            this.onInit();
        }
    };

    $.fn.dropster = function (options) {
        return this.each(function() {
            // Save the instance to make sure the plugin does
            // not get called multiple times on same element.
            // Instead, it should update the settings.
            var instance = $(this).data("plugin_dropster");
            if (!instance) {
                $(this).data("plugin_dropster", new Dropster(this, options));
            } else {
                instance.updateSettings(options);
            }
        });
    };

})(jQuery);
