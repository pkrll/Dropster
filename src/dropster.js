/**
 * Dropster 1.5
 *
 * Dropster abstracts and simplifies drag and
 * drop and enables file uploads with AJAX.
 *
 * @version 1.5.1
 * @author Ardalan Samimi
 */
(function () {

    if (window.jQuery) {
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
    }

    Element.prototype.dropster = function (options) {
        return new Dropster(this, options);
    }

    // Default settings
    var defaults = {
        url             : false,
        auto            : true,
        createArea      : false,
        uploadLimit     : 0,
        loaderImagePath : "/node_modules/dropster/lib/loading-128.png",
        extensions      : ["jpg", "jpeg", "gif", "png"],
        monitor         : false,
        onDownload      : function(progressEvent) { },
        onUpload        : function(progressEvent) { },
        onChange        : function(state, status) { },
        onReady         : function(response)      { },
        onError         : function(errorMessage)  { }
    }
    /**
     * Constructor
     *
     * @param       HTMLElement     The element to extend
     * @param       object          Collection of settings
     */
     var Dropster = function (element, options) {
        this.element    = element;
        this.inputFile  = false;
        this.settings   = this.extend(options, defaults);
        this.globals    = {
            highlightClassName: "dropster-highlight"
        }
        if (this.settings.createArea === true)
        this.createDropArea();
        // Set the public interface property,
        // and turn auto upload on or off.
        this.setPublicInterface();
        if (this.settings.auto === true)
            this.setAutoUpload();
        // Bind the drag events
        this.on(this.element, "dragenter", this.dragEnter.bind(this));
        this.on(this.element, "dragleave", this.dragLeave.bind(this));
        this.on(this.element, "dragover", this.dragLeave.bind(this));
        this.on(this.element, "drop", this.drop.bind(this));
        this.on(document, "dragenter", this.dragEnter.bind(this));
        this.on(document, "dragover", this.dragLeave.bind(this));
        this.on(document, "drop", this.drop.bind(this));
    }

    Dropster.prototype = {
        /**
         * Add an event listener to a given element.
         *
         * @param       HTMLElement     Element to attach the listener to
         * @param       event           Type of event
         * @param       function        The callback
         */
        on: function (element, event, callback) {
            element.addEventListener(event, function (e) { callback(e, element); }, false);
        },
        /**
         * Callback for dragenter event. Highlights the drop zone.
         *
         * @param   eventObject
         * @param   Element
         */
        dragEnter: function (event, element) {
            var element = element || false;
            if (element === this.element &&
                element.classList.contains(this.globals.highlightClassName) === false)
                element.classList.add(this.globals.highlightClassName);
            this.onDrop(event);
        },
        /**
         * Callback for dragleave and dragover events. Turns the
         * border highlight off.
         *
         * @param   eventObject
         * @param   Element
         */
        dragLeave: function (event, element) {
            var element = element || false;
            if (element !== this.element &&
                this.element.classList.contains(this.globals.highlightClassName) === true)
                this.element.classList.remove(this.globals.highlightClassName);
            this.onDrop(event);
        },
        /**
         * Callback for drop event.
         *
         * @param   eventObject
         * @param   Element
         */
        drop: function (event, element) {
            var element = element || false;
            if (element === this.element) {
                element.classList.remove(this.globals.highlightClassName);
                this.onDrop(event, true, true);
            } else {
                this.onDrop(event, false, false);
            }
        },
        /**
         * Determines if the drag/drop was valid and creates a
         * formData object to send to the method sendDrop.
         *
         * @param eventObject   To stop default actions
         * @param        bool   Is upload, yes?
         * @param        bool   Was drop, no?
         */
        onDrop: function (event, upload, drop) {
            var upload = upload || false, drop = drop || false;
            event.stopPropagation();
            event.preventDefault();
            // Check if an object was dropped on the
            // designated target area or not.
            if (upload === true) {
                // Sort through the dropped files and
                // add them to the formdata object.
                var files = (drop) ? event.dataTransfer.files : event.currentTarget.files;
                var fData = new FormData();
                for (var i = 0; i < files.length; i++) {
                    // Check the file extensions against
                    // the allowed extensions.
                    if (this.checkExtension(files[i].name) === false) {
                        this.publicInterface.onError("Could not upload file " + files[i].name + ". File extension not allowed.");
                        return false;
                    } else {
                        fData.append("file_"+i, files[i]);
                    }
                    // Stop if upload limit is reached
                    if (this.settings.uploadLimit !== 0 &&
                        this.settings.uploadLimit === (i+1))
                        break;
                }
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
             var dataPackage = dataPackage || false, packageSize = packageSize || false;
             if (dataPackage === false || packageSize === false)
                return false;
            var self = this, xhr = new XMLHttpRequest();
            self.publicInterface.totalSizeToLoad = packageSize;
            // Set the monitoring methods
            xhr.upload.onprogress = function (event) {
                self.publicInterface.onUpload(event);
            }
            xhr.onprogress = function (event) {
                self.publicInterface.onDownload(event);
            }
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4 && xhr.status === 200)
                    self.publicInterface.onReady(xhr.responseText);
                else
                    self.publicInterface.onChange(xhr.readyState, xhr.status);
            }
            // Make sure URL is set before request
            if (self.settings.url !== false) {
                xhr.open("POST", self.settings.url);
                xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        		xhr.send(dataPackage);
            } else {
                self.publicInterface.onError("No upload path set");
            }
         },
        /**
         * Creates a public interface property comprised of
         * the public methods and variables for user access.
         *
         */
        setPublicInterface: function () {
            // The regular expression pattern for an empty function
            var emptyFunction = new RegExp(/(\{\s\})|(\{\})/),
                publicMethods = {};
            // Loop through the settings variable and
            // check for all the methods defined there.
            for (method in this.settings) {
                if (typeof this.settings[method] === 'function' &&
                    typeof this[method] === 'function') {
                    var string = this.settings[method].toString();
                    // Empty methods (that is, methods not overriden) should be
                    // replaced by the default method in the public interface,
                    // otherwise, also add a default* method too.
                    if (emptyFunction.test(string)) {
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
            // and add it as a property of the public interface
            var inputFile = this.element.querySelectorAll("input[type=file]")[0];
            if (inputFile !== null && typeof inputFile !== 'undefined') {
                var self = this;
                this.inputFile = inputFile;
                this.publicInterface.resetFileInput = this.resetFileInput.bind(this);
                this.on(this.inputFile, "change", function (event) {
                    self.onDrop(event, true, false);
                });
            }
        },
        /**
         * Extend a given object with another object.
         *
         * @param       object      Object that is to be extended
         * @param       object      Object with properties to add to first object
         * @returns     object
         */
        extend: function (options, source) {
            for (var property in source)
                if (options.hasOwnProperty(property) === false)
                    options[property] = source[property];
            return options;
        },
        /**
         * Prepends method name with string "default", using camelCase.
         *
         * @param       string      Name to manipulate
         * @returns     string
         */
        createDefaultMethodName: function(name) {
            if (/[A-Z]/.test(name.charAt(0)))
                return "default" + name;
            var firstLetter = name.charAt(0);
            return "default" + firstLetter.toUpperCase() + name.substring(1);
        },
        /**
         * Check the extension of the file(s) to be uploaded, comparing
         * to the array of file extensions set in the array extensions.
         *
         * @param   string  Name of file
         * @returns   bool
         */
        checkExtension: function (fileName) {
            extension = fileName.split('.').pop().toLowerCase();
            if (this.settings.extensions.indexOf(extension) !== -1)
                return true;
            return false;
        },
        /**
         * Outputs the progress.
         *
         * @param   string  The output string
         */
        onProgress: function (progress) {
            var dropsterWindow = document.getElementById("dropster-window");
            if (dropsterWindow === null)
                dropsterWindow = this.createWindow(true);
            divHeader = dropsterWindow.getElementsByClassName("dropster-window-header")[0];
            divHeader.innerHTML = progress;
        },
        /**
         * Default monitoring function for downloading and getting
         * response from the server. Will be called if not overriden.
         *
         * @param   progressEvent   The progressEvent object from XMLHttpRequest onprogress
         */
        onDownload: function (event) {
            // Calculate the progress and show it.
            var completed = (Math.round((++this.publicInterface.totalSizeLoaded / this.publicInterface.totalSizeToLoad * 1000) / 10));
            this.onProgress("Uploading files... " + completed + "%");
        },
        /**
         * Default monitoring function for uploading to the server,
         * will be called if not overriden.
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
         * @param   int     state
         * @param   int     status
         * @param   object  responseText
         */
        onChange: function (state, status) {
            if (state === 4 && status === 404)
                this.onError("Error code " + status);
        },
        /**
         * The default ready function called when the upload
         * process is finished, will be called if not overridden.
         *
         * @param   mixed   Response property of an XMLHttpRequest object
         */
        onReady: function (responseText) {
            // Clear the file input, if it exists
            this.resetFileInput();
            var dropsterWindow = document.getElementById("dropster-window");
            if (dropsterWindow === null)
                dropsterWindow = this.createWindow(false);
            var divHeader   = dropsterWindow.getElementsByClassName("dropster-window-header")[0];
            var divBody     = dropsterWindow.getElementsByClassName("dropster-window-body")[0];
            // Set the new status
            divHeader.innerHTML = "Upload finish!";
            while (divBody.lastChild)
                divBody.removeChild(divBody.lastChild);
            divBody.innerHTML = "The files have been successfully uploaded.";
        },
        /**
         * Called upon error. Can be ovverridden.
         *
         * @param   string  The error message
         */
        onError: function (message) {
            var dropsterWindow = document.getElementById("dropster-window");
            if (dropsterWindow === null)
                dropsterWindow = this.createWindow(false);
            var divHeader   = dropsterWindow.getElementsByClassName("dropster-window-header")[0];
            var divBody     = dropsterWindow.getElementsByClassName("dropster-window-body")[0];
            // Set the new status
            divHeader.innerHTML = "Upload error!";
            while (divBody.lastChild)
                divBody.removeChild(divBody.lastChild);
            divBody.innerHTML = "An error has occurred: " + message;
        },
        /**
         * Clone and return an element, with options to
         * set its attributes and innerHTML.
         *
         * @param       Element     Element to clone
         * @param       object      Collection of attributes
         * @param       string      contents of new element
         * @returns     Element
         */
        cloneElement: function (element, attributes, html) {
            var html = html || null;
            var newElement = element.cloneNode(false);
            for (var attribute in attributes)
                newElement.setAttribute(attribute, attributes[attribute]);
            if (html !== null)
                newElement.innerHTML = html;
            return newElement;
        },
        /**
         * Creates a droparea, if specified.
         *
         */
        createDropArea: function () {
            var paragraph = document.createElement("p");
            // The content of the drop area
            var description = this.cloneElement(paragraph, {}, "Drag and drop files here or use the browse button below");
            var container   = this.cloneElement(paragraph, {});
            var fileInput   = this.cloneElement(document.createElement("input"), {"type": "file"});
            container.appendChild(fileInput);
            this.element.appendChild(description);
            this.element.appendChild(container);
            this.element.classList.add("dropster-target-area");
        },
        /**
         * Creates a dialog window, for the default progress
         * monitoring event.
         *
         * @param   bool    If a spinner should be shown.
         */
        createWindow: function (withLoaderImage) {
            var withLoaderImage = withLoaderImage || false;
            var div = document.createElement("div");
            // Create the window
            var divWindow   = this.cloneElement(div, {"id": "dropster-window"});
            var divHeader   = this.cloneElement(div, {"class": "dropster-window-header"});
            var divBody     = this.cloneElement(div, {"class": "dropster-window-body"});
            var divFooter   = this.cloneElement(div, {"class": "dropster-window-footer"});
            var divButton   = this.cloneElement(div, {"class": "dropster-window-button"}, "OK");
            // Make appends
            divWindow.appendChild(divHeader);
            divWindow.appendChild(divBody);
            divWindow.appendChild(divFooter);
            divFooter.appendChild(divButton);
            // Bind button
            divButton.addEventListener("click", function() {
                var parent = divWindow.parentNode;
                parent.removeChild(divWindow);
            });
            // Add spinner image
            if (withLoaderImage) {
                var imgElement = document.createElement("img");
                imgElement.src = this.settings.loaderImagePath;
                divBody.appendChild(imgElement);
            }

            document.body.appendChild(divWindow);
            return divWindow;
        },
        /**
         * Resets the file input
         *
         */
        resetFileInput: function () {
            if (this.inputFile !== false) {
                this.inputFile.value = "";
            }
        }
    }

})();
