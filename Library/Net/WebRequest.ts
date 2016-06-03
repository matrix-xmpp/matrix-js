/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */

/// <reference path="webrequesteventargs.ts" />
module Matrix.Net {
    /*
     * 
     * http://xmpp.ag-software.net:5280/http-bind/
     * <body 
     * rid='1996404094'
     *  xmlns='http://jabber.org/protocol/httpbind' 
     * to='anon.ag-software.net'
     *  xml:lang='en'
     *  wait='60'
     *  hold='1'
     *  content='text/xml; charset=utf-8' ver='1.6' 
     * xmpp:version='1.0' 
     * xmlns:xmpp='urn:xmpp:xbosh'/>
     */
    
    export class WebRequest {
        webRequest: XMLHttpRequest = null;
        tag: string;
        url: string;
        data: string;
        isBusy: boolean = false;

        public onReadData   = new GenericEvent<WebRequestEventArgs>();
        public onSendData   = new GenericEvent<WebRequestEventArgs>();
        public onError      = new GenericEvent<ExceptionEventArgs>();

        constructor(url: string, tag: string) {
            this.url = url;
            this.tag = tag;
            this.create();
        }

        private create(): void {
            if (XMLHttpRequest) {
                this.webRequest = new XMLHttpRequest();
                if (this.webRequest.overrideMimeType) {
                    this.webRequest.overrideMimeType("text/xml; charset=utf-8");
                }
            } else if (ActiveXObject) {
                this.webRequest = new ActiveXObject("Microsoft.XMLHTTP");
            }
            this.webRequest.onreadystatechange = this.requestOnreadyStateChange(this);
        }

        private requestOnreadyStateChange(webRequest: WebRequest) {
            /*
                State  Description
                0      The request is not initialized
                1      The request has been set up
                2      The request has been sent
                3      The request is in process
                4      The request is complete  

                The XMLHttpRequest object can be in several states. The readyState attribute must return the current state, 
                which must be one of the following values:

                UNSENT (numeric value 0)
                The object has been constructed.

                OPENED (numeric value 1)
                The open() method has been successfully invoked. During this state request headers can be set using setRequestHeader() 
                and the request can be made using the send() method.

                HEADERS_RECEIVED (numeric value 2)
                All redirects (if any) have been followed and all HTTP headers of the final response have been received.
                Several response members of the object are now available.

                LOADING (numeric value 3)
                The response entity body is being received.

                DONE (numeric value 4)
                The data transfer has been completed or something went wrong during the transfer (e.g. infinite redirects).           
            */

            return function() {
                //console.log("ready state " + this.readyState);
                if (this.readyState == 4) {
                    var reqStatus = 0;
                    try {
                        reqStatus = this.status;
                    } catch (e) {

                    }

                    if (this.status == 200) {
                        // All right - data is stored in xhr.responseText
                        //alert(this.responseText);
                        webRequest.onSendData.trigger(new WebRequestEventArgs(webRequest.data, webRequest.tag));
                        webRequest.onReadData.trigger(new WebRequestEventArgs(this.responseText, webRequest.tag));
                    } else {
                        webRequest.onError.trigger(new ExceptionEventArgs("webrequest Error"));
                        // Server responded with another status code!
                    }
                    webRequest.isBusy = false;
                }
            }
        }

        public execute(data: string) {
            this.data = data;
            this.isBusy = true;
            this.webRequest.open("POST", this.url, true);
            this.webRequest.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
            this.webRequest.send(data);
        }

        /* cancel the webrequest */
        public cancel() {
            // abort requets and assign empty function for callback
            this.webRequest.abort();
            this.webRequest.onreadystatechange = () => {};
        }
    }
} 