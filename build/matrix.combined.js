/*!
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net
 */

// wrapper for non-node envs
; (function (sax) {

    sax.parser = function (strict, opt) { return new SAXParser(strict, opt) }
    sax.SAXParser = SAXParser
    sax.SAXStream = SAXStream
    sax.createStream = createStream

    // When we pass the MAX_BUFFER_LENGTH position, start checking for buffer overruns.
    // When we check, schedule the next check for MAX_BUFFER_LENGTH - (max(buffer lengths)),
    // since that's the earliest that a buffer overrun could occur.  This way, checks are
    // as rare as required, but as often as necessary to ensure never crossing this bound.
    // Furthermore, buffers are only tested at most once per write(), so passing a very
    // large string into write() might have undesirable effects, but this is manageable by
    // the caller, so it is assumed to be safe.  Thus, a call to write() may, in the extreme
    // edge case, result in creating at most one complete copy of the string passed in.
    // Set to Infinity to have unlimited buffers.
    sax.MAX_BUFFER_LENGTH = 64 * 1024

    var buffers = [
      "comment", "sgmlDecl", "textNode", "tagName", "doctype",
      "procInstName", "procInstBody", "entity", "attribName",
      "attribValue", "cdata", "script"
    ]

    sax.EVENTS = // for discoverability.
      ["text"
      , "processinginstruction"
      , "sgmldeclaration"
      , "doctype"
      , "comment"
      , "attribute"
      , "opentag"
      , "closetag"
      , "opencdata"
      , "cdata"
      , "closecdata"
      , "error"
      , "end"
      , "ready"
      , "script"
      , "opennamespace"
      , "closenamespace"
      ]

    function SAXParser(strict, opt) {
        if (!(this instanceof SAXParser)) return new SAXParser(strict, opt)

        var parser = this
        clearBuffers(parser)
        parser.q = parser.c = ""
        parser.bufferCheckPosition = sax.MAX_BUFFER_LENGTH
        parser.opt = opt || {}
        parser.opt.lowercase = parser.opt.lowercase || parser.opt.lowercasetags
        parser.looseCase = parser.opt.lowercase ? "toLowerCase" : "toUpperCase"
        parser.tags = []
        parser.closed = parser.closedRoot = parser.sawRoot = false
        parser.tag = parser.error = null
        parser.strict = !!strict
        parser.noscript = !!(strict || parser.opt.noscript)
        parser.state = S.BEGIN
        parser.ENTITIES = Object.create(sax.ENTITIES)
        parser.attribList = []

        // namespaces form a prototype chain.
        // it always points at the current tag,
        // which protos to its parent tag.
        if (parser.opt.xmlns) parser.ns = Object.create(rootNS)

        // mostly just for error reporting
        parser.trackPosition = parser.opt.position !== false
        if (parser.trackPosition) {
            parser.position = parser.line = parser.column = 0
        }
        emit(parser, "onready")
    }

    if (!Object.create) Object.create = function (o) {
        function f() { this.__proto__ = o }
        f.prototype = o
        return new f
    }

    if (!Object.getPrototypeOf) Object.getPrototypeOf = function (o) {
        return o.__proto__
    }

    if (!Object.keys) Object.keys = function (o) {
        var a = []
        for (var i in o) if (o.hasOwnProperty(i)) a.push(i)
        return a
    }

    function checkBufferLength(parser) {
        var maxAllowed = Math.max(sax.MAX_BUFFER_LENGTH, 10)
          , maxActual = 0
        for (var i = 0, l = buffers.length; i < l; i++) {
            var len = parser[buffers[i]].length
            if (len > maxAllowed) {
                // Text/cdata nodes can get big, and since they're buffered,
                // we can get here under normal conditions.
                // Avoid issues by emitting the text node now,
                // so at least it won't get any bigger.
                switch (buffers[i]) {
                    case "textNode":
                        closeText(parser)
                        break

                    case "cdata":
                        emitNode(parser, "oncdata", parser.cdata)
                        parser.cdata = ""
                        break

                    case "script":
                        emitNode(parser, "onscript", parser.script)
                        parser.script = ""
                        break

                    default:
                        error(parser, "Max buffer length exceeded: " + buffers[i])
                }
            }
            maxActual = Math.max(maxActual, len)
        }
        // schedule the next check for the earliest possible buffer overrun.
        parser.bufferCheckPosition = (sax.MAX_BUFFER_LENGTH - maxActual)
                                   + parser.position
    }

    function clearBuffers(parser) {
        for (var i = 0, l = buffers.length; i < l; i++) {
            parser[buffers[i]] = ""
        }
    }

    function flushBuffers(parser) {
        closeText(parser)
        if (parser.cdata !== "") {
            emitNode(parser, "oncdata", parser.cdata)
            parser.cdata = ""
        }
        if (parser.script !== "") {
            emitNode(parser, "onscript", parser.script)
            parser.script = ""
        }
    }

    SAXParser.prototype =
      {
          end: function () { end(this) }
      , write: write
      , resume: function () { this.error = null; return this }
      , close: function () { return this.write(null) }
      , flush: function () { flushBuffers(this) }
      }

    try {
        var Stream = require("stream").Stream
    } catch (ex) {
        var Stream = function () { }
    }


    var streamWraps = sax.EVENTS.filter(function (ev) {
        return ev !== "error" && ev !== "end"
    })

    function createStream(strict, opt) {
        return new SAXStream(strict, opt)
    }

    function SAXStream(strict, opt) {
        if (!(this instanceof SAXStream)) return new SAXStream(strict, opt)

        Stream.apply(this)

        this._parser = new SAXParser(strict, opt)
        this.writable = true
        this.readable = true


        var me = this

        this._parser.onend = function () {
            me.emit("end")
        }

        this._parser.onerror = function (er) {
            me.emit("error", er)

            // if didn't throw, then means error was handled.
            // go ahead and clear error, so we can write again.
            me._parser.error = null
        }

        this._decoder = null;

        streamWraps.forEach(function (ev) {
            Object.defineProperty(me, "on" + ev, {
                get: function () { return me._parser["on" + ev] },
                set: function (h) {
                    if (!h) {
                        me.removeAllListeners(ev)
                        return me._parser["on" + ev] = h
                    }
                    me.on(ev, h)
                },
                enumerable: true,
                configurable: false
            })
        })
    }

    SAXStream.prototype = Object.create(Stream.prototype,
      { constructor: { value: SAXStream } })

    SAXStream.prototype.write = function (data) {
        if (typeof Buffer === 'function' &&
            typeof Buffer.isBuffer === 'function' &&
            Buffer.isBuffer(data)) {
            if (!this._decoder) {
                var SD = require('string_decoder').StringDecoder
                this._decoder = new SD('utf8')
            }
            data = this._decoder.write(data);
        }

        this._parser.write(data.toString())
        this.emit("data", data)
        return true
    }

    SAXStream.prototype.end = function (chunk) {
        if (chunk && chunk.length) this.write(chunk)
        this._parser.end()
        return true
    }

    SAXStream.prototype.on = function (ev, handler) {
        var me = this
        if (!me._parser["on" + ev] && streamWraps.indexOf(ev) !== -1) {
            me._parser["on" + ev] = function () {
                var args = arguments.length === 1 ? [arguments[0]]
                         : Array.apply(null, arguments)
                args.splice(0, 0, ev)
                me.emit.apply(me, args)
            }
        }

        return Stream.prototype.on.call(me, ev, handler)
    }



    // character classes and tokens
    var whitespace = "\r\n\t "
      // this really needs to be replaced with character classes.
      // XML allows all manner of ridiculous numbers and digits.
      , number = "0124356789"
      , letter = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
      // (Letter | "_" | ":")
      , quote = "'\""
      , entity = number + letter + "#"
      , attribEnd = whitespace + ">"
      , CDATA = "[CDATA["
      , DOCTYPE = "DOCTYPE"
      , XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace"
      , XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/"
      , rootNS = { xml: XML_NAMESPACE, xmlns: XMLNS_NAMESPACE }

    // turn all the string character sets into character class objects.
    whitespace = charClass(whitespace)
    number = charClass(number)
    letter = charClass(letter)

    // http://www.w3.org/TR/REC-xml/#NT-NameStartChar
    // This implementation works on strings, a single character at a time
    // as such, it cannot ever support astral-plane characters (10000-EFFFF)
    // without a significant breaking change to either this  parser, or the
    // JavaScript language.  Implementation of an emoji-capable xml parser
    // is left as an exercise for the reader.
    var nameStart = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/

    var nameBody = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040\.\d-]/

    quote = charClass(quote)
    entity = charClass(entity)
    attribEnd = charClass(attribEnd)

    function charClass(str) {
        return str.split("").reduce(function (s, c) {
            s[c] = true
            return s
        }, {})
    }

    function isRegExp(c) {
        return Object.prototype.toString.call(c) === '[object RegExp]'
    }

    function is(charclass, c) {
        return isRegExp(charclass) ? !!c.match(charclass) : charclass[c]
    }

    function not(charclass, c) {
        return !is(charclass, c)
    }

    var S = 0
    sax.STATE =
    {
        BEGIN: S++
    , TEXT: S++ // general stuff
    , TEXT_ENTITY: S++ // &amp and such.
    , OPEN_WAKA: S++ // <
    , SGML_DECL: S++ // <!BLARG
    , SGML_DECL_QUOTED: S++ // <!BLARG foo "bar
    , DOCTYPE: S++ // <!DOCTYPE
    , DOCTYPE_QUOTED: S++ // <!DOCTYPE "//blah
    , DOCTYPE_DTD: S++ // <!DOCTYPE "//blah" [ ...
    , DOCTYPE_DTD_QUOTED: S++ // <!DOCTYPE "//blah" [ "foo
    , COMMENT_STARTING: S++ // <!-
    , COMMENT: S++ // <!--
    , COMMENT_ENDING: S++ // <!-- blah -
    , COMMENT_ENDED: S++ // <!-- blah --
    , CDATA: S++ // <![CDATA[ something
    , CDATA_ENDING: S++ // ]
    , CDATA_ENDING_2: S++ // ]]
    , PROC_INST: S++ // <?hi
    , PROC_INST_BODY: S++ // <?hi there
    , PROC_INST_ENDING: S++ // <?hi "there" ?
    , OPEN_TAG: S++ // <strong
    , OPEN_TAG_SLASH: S++ // <strong /
    , ATTRIB: S++ // <a
    , ATTRIB_NAME: S++ // <a foo
    , ATTRIB_NAME_SAW_WHITE: S++ // <a foo _
    , ATTRIB_VALUE: S++ // <a foo=
    , ATTRIB_VALUE_QUOTED: S++ // <a foo="bar
    , ATTRIB_VALUE_CLOSED: S++ // <a foo="bar"
    , ATTRIB_VALUE_UNQUOTED: S++ // <a foo=bar
    , ATTRIB_VALUE_ENTITY_Q: S++ // <foo bar="&quot;"
    , ATTRIB_VALUE_ENTITY_U: S++ // <foo bar=&quot;
    , CLOSE_TAG: S++ // </a
    , CLOSE_TAG_SAW_WHITE: S++ // </a   >
    , SCRIPT: S++ // <script> ...
    , SCRIPT_ENDING: S++ // <script> ... <
    }

    sax.ENTITIES =
    {
        "amp": "&"
    , "gt": ">"
    , "lt": "<"
    , "quot": "\""
    , "apos": "'"
    , "AElig": 198
    , "Aacute": 193
    , "Acirc": 194
    , "Agrave": 192
    , "Aring": 197
    , "Atilde": 195
    , "Auml": 196
    , "Ccedil": 199
    , "ETH": 208
    , "Eacute": 201
    , "Ecirc": 202
    , "Egrave": 200
    , "Euml": 203
    , "Iacute": 205
    , "Icirc": 206
    , "Igrave": 204
    , "Iuml": 207
    , "Ntilde": 209
    , "Oacute": 211
    , "Ocirc": 212
    , "Ograve": 210
    , "Oslash": 216
    , "Otilde": 213
    , "Ouml": 214
    , "THORN": 222
    , "Uacute": 218
    , "Ucirc": 219
    , "Ugrave": 217
    , "Uuml": 220
    , "Yacute": 221
    , "aacute": 225
    , "acirc": 226
    , "aelig": 230
    , "agrave": 224
    , "aring": 229
    , "atilde": 227
    , "auml": 228
    , "ccedil": 231
    , "eacute": 233
    , "ecirc": 234
    , "egrave": 232
    , "eth": 240
    , "euml": 235
    , "iacute": 237
    , "icirc": 238
    , "igrave": 236
    , "iuml": 239
    , "ntilde": 241
    , "oacute": 243
    , "ocirc": 244
    , "ograve": 242
    , "oslash": 248
    , "otilde": 245
    , "ouml": 246
    , "szlig": 223
    , "thorn": 254
    , "uacute": 250
    , "ucirc": 251
    , "ugrave": 249
    , "uuml": 252
    , "yacute": 253
    , "yuml": 255
    , "copy": 169
    , "reg": 174
    , "nbsp": 160
    , "iexcl": 161
    , "cent": 162
    , "pound": 163
    , "curren": 164
    , "yen": 165
    , "brvbar": 166
    , "sect": 167
    , "uml": 168
    , "ordf": 170
    , "laquo": 171
    , "not": 172
    , "shy": 173
    , "macr": 175
    , "deg": 176
    , "plusmn": 177
    , "sup1": 185
    , "sup2": 178
    , "sup3": 179
    , "acute": 180
    , "micro": 181
    , "para": 182
    , "middot": 183
    , "cedil": 184
    , "ordm": 186
    , "raquo": 187
    , "frac14": 188
    , "frac12": 189
    , "frac34": 190
    , "iquest": 191
    , "times": 215
    , "divide": 247
    , "OElig": 338
    , "oelig": 339
    , "Scaron": 352
    , "scaron": 353
    , "Yuml": 376
    , "fnof": 402
    , "circ": 710
    , "tilde": 732
    , "Alpha": 913
    , "Beta": 914
    , "Gamma": 915
    , "Delta": 916
    , "Epsilon": 917
    , "Zeta": 918
    , "Eta": 919
    , "Theta": 920
    , "Iota": 921
    , "Kappa": 922
    , "Lambda": 923
    , "Mu": 924
    , "Nu": 925
    , "Xi": 926
    , "Omicron": 927
    , "Pi": 928
    , "Rho": 929
    , "Sigma": 931
    , "Tau": 932
    , "Upsilon": 933
    , "Phi": 934
    , "Chi": 935
    , "Psi": 936
    , "Omega": 937
    , "alpha": 945
    , "beta": 946
    , "gamma": 947
    , "delta": 948
    , "epsilon": 949
    , "zeta": 950
    , "eta": 951
    , "theta": 952
    , "iota": 953
    , "kappa": 954
    , "lambda": 955
    , "mu": 956
    , "nu": 957
    , "xi": 958
    , "omicron": 959
    , "pi": 960
    , "rho": 961
    , "sigmaf": 962
    , "sigma": 963
    , "tau": 964
    , "upsilon": 965
    , "phi": 966
    , "chi": 967
    , "psi": 968
    , "omega": 969
    , "thetasym": 977
    , "upsih": 978
    , "piv": 982
    , "ensp": 8194
    , "emsp": 8195
    , "thinsp": 8201
    , "zwnj": 8204
    , "zwj": 8205
    , "lrm": 8206
    , "rlm": 8207
    , "ndash": 8211
    , "mdash": 8212
    , "lsquo": 8216
    , "rsquo": 8217
    , "sbquo": 8218
    , "ldquo": 8220
    , "rdquo": 8221
    , "bdquo": 8222
    , "dagger": 8224
    , "Dagger": 8225
    , "bull": 8226
    , "hellip": 8230
    , "permil": 8240
    , "prime": 8242
    , "Prime": 8243
    , "lsaquo": 8249
    , "rsaquo": 8250
    , "oline": 8254
    , "frasl": 8260
    , "euro": 8364
    , "image": 8465
    , "weierp": 8472
    , "real": 8476
    , "trade": 8482
    , "alefsym": 8501
    , "larr": 8592
    , "uarr": 8593
    , "rarr": 8594
    , "darr": 8595
    , "harr": 8596
    , "crarr": 8629
    , "lArr": 8656
    , "uArr": 8657
    , "rArr": 8658
    , "dArr": 8659
    , "hArr": 8660
    , "forall": 8704
    , "part": 8706
    , "exist": 8707
    , "empty": 8709
    , "nabla": 8711
    , "isin": 8712
    , "notin": 8713
    , "ni": 8715
    , "prod": 8719
    , "sum": 8721
    , "minus": 8722
    , "lowast": 8727
    , "radic": 8730
    , "prop": 8733
    , "infin": 8734
    , "ang": 8736
    , "and": 8743
    , "or": 8744
    , "cap": 8745
    , "cup": 8746
    , "int": 8747
    , "there4": 8756
    , "sim": 8764
    , "cong": 8773
    , "asymp": 8776
    , "ne": 8800
    , "equiv": 8801
    , "le": 8804
    , "ge": 8805
    , "sub": 8834
    , "sup": 8835
    , "nsub": 8836
    , "sube": 8838
    , "supe": 8839
    , "oplus": 8853
    , "otimes": 8855
    , "perp": 8869
    , "sdot": 8901
    , "lceil": 8968
    , "rceil": 8969
    , "lfloor": 8970
    , "rfloor": 8971
    , "lang": 9001
    , "rang": 9002
    , "loz": 9674
    , "spades": 9824
    , "clubs": 9827
    , "hearts": 9829
    , "diams": 9830
    }

    Object.keys(sax.ENTITIES).forEach(function (key) {
        var e = sax.ENTITIES[key]
        var s = typeof e === 'number' ? String.fromCharCode(e) : e
        sax.ENTITIES[key] = s
    })

    for (var S in sax.STATE) sax.STATE[sax.STATE[S]] = S

    // shorthand
    S = sax.STATE

    function emit(parser, event, data) {
        parser[event] && parser[event](data)
    }

    function emitNode(parser, nodeType, data) {
        if (parser.textNode) closeText(parser)
        emit(parser, nodeType, data)
    }

    function closeText(parser) {
        parser.textNode = textopts(parser.opt, parser.textNode)
        if (parser.textNode) emit(parser, "ontext", parser.textNode)
        parser.textNode = ""
    }

    function textopts(opt, text) {
        if (opt.trim) text = text.trim()
        if (opt.normalize) text = text.replace(/\s+/g, " ")
        return text
    }

    function error(parser, er) {
        closeText(parser)
        if (parser.trackPosition) {
            er += "\nLine: " + parser.line +
                  "\nColumn: " + parser.column +
                  "\nChar: " + parser.c
        }
        er = new Error(er)
        parser.error = er
        emit(parser, "onerror", er)
        return parser
    }

    function end(parser) {
        if (!parser.closedRoot) strictFail(parser, "Unclosed root tag")
        if ((parser.state !== S.BEGIN) && (parser.state !== S.TEXT)) error(parser, "Unexpected end")
        closeText(parser)
        parser.c = ""
        parser.closed = true
        emit(parser, "onend")
        SAXParser.call(parser, parser.strict, parser.opt)
        return parser
    }

    function strictFail(parser, message) {
        if (typeof parser !== 'object' || !(parser instanceof SAXParser))
            throw new Error('bad call to strictFail');
        if (parser.strict) error(parser, message)
    }

    function newTag(parser) {
        if (!parser.strict) parser.tagName = parser.tagName[parser.looseCase]()
        var parent = parser.tags[parser.tags.length - 1] || parser
          , tag = parser.tag = { name: parser.tagName, attributes: {} }

        // will be overridden if tag contails an xmlns="foo" or xmlns:foo="bar"
        if (parser.opt.xmlns) tag.ns = parent.ns
        parser.attribList.length = 0
    }

    function qname(name, attribute) {
        var i = name.indexOf(":")
          , qualName = i < 0 ? ["", name] : name.split(":")
          , prefix = qualName[0]
          , local = qualName[1]

        // <x "xmlns"="http://foo">
        if (attribute && name === "xmlns") {
            prefix = "xmlns"
            local = ""
        }

        return { prefix: prefix, local: local }
    }

    function attrib(parser) {
        if (!parser.strict) parser.attribName = parser.attribName[parser.looseCase]()

        if (parser.attribList.indexOf(parser.attribName) !== -1 ||
            parser.tag.attributes.hasOwnProperty(parser.attribName)) {
            return parser.attribName = parser.attribValue = ""
        }

        if (parser.opt.xmlns) {
            var qn = qname(parser.attribName, true)
              , prefix = qn.prefix
              , local = qn.local

            if (prefix === "xmlns") {
                // namespace binding attribute; push the binding into scope
                if (local === "xml" && parser.attribValue !== XML_NAMESPACE) {
                    strictFail(parser
                              , "xml: prefix must be bound to " + XML_NAMESPACE + "\n"
                              + "Actual: " + parser.attribValue)
                } else if (local === "xmlns" && parser.attribValue !== XMLNS_NAMESPACE) {
                    strictFail(parser
                              , "xmlns: prefix must be bound to " + XMLNS_NAMESPACE + "\n"
                              + "Actual: " + parser.attribValue)
                } else {
                    var tag = parser.tag
                      , parent = parser.tags[parser.tags.length - 1] || parser
                    if (tag.ns === parent.ns) {
                        tag.ns = Object.create(parent.ns)
                    }
                    tag.ns[local] = parser.attribValue
                }
            }

            // defer onattribute events until all attributes have been seen
            // so any new bindings can take effect; preserve attribute order
            // so deferred events can be emitted in document order
            parser.attribList.push([parser.attribName, parser.attribValue])
        } else {
            // in non-xmlns mode, we can emit the event right away
            parser.tag.attributes[parser.attribName] = parser.attribValue
            emitNode(parser
                    , "onattribute"
                    , {
                        name: parser.attribName
                      , value: parser.attribValue
                    })
        }

        parser.attribName = parser.attribValue = ""
    }

    function openTag(parser, selfClosing) {
        if (parser.opt.xmlns) {
            // emit namespace binding events
            var tag = parser.tag

            // add namespace info to tag
            var qn = qname(parser.tagName)
            tag.prefix = qn.prefix
            tag.local = qn.local
            tag.uri = tag.ns[qn.prefix] || ""

            if (tag.prefix && !tag.uri) {
                strictFail(parser, "Unbound namespace prefix: "
                                 + JSON.stringify(parser.tagName))
                tag.uri = qn.prefix
            }

            var parent = parser.tags[parser.tags.length - 1] || parser
            if (tag.ns && parent.ns !== tag.ns) {
                Object.keys(tag.ns).forEach(function (p) {
                    emitNode(parser
                            , "onopennamespace"
                            , { prefix: p, uri: tag.ns[p] })
                })
            }

            // handle deferred onattribute events
            // Note: do not apply default ns to attributes:
            //   http://www.w3.org/TR/REC-xml-names/#defaulting
            for (var i = 0, l = parser.attribList.length; i < l; i++) {
                var nv = parser.attribList[i]
                var name = nv[0]
                  , value = nv[1]
                  , qualName = qname(name, true)
                  , prefix = qualName.prefix
                  , local = qualName.local
                  , uri = prefix == "" ? "" : (tag.ns[prefix] || "")
                  , a = {
                      name: name
                        , value: value
                        , prefix: prefix
                        , local: local
                        , uri: uri
                  }

                // if there's any attributes with an undefined namespace,
                // then fail on them now.
                if (prefix && prefix != "xmlns" && !uri) {
                    strictFail(parser, "Unbound namespace prefix: "
                                     + JSON.stringify(prefix))
                    a.uri = prefix
                }
                parser.tag.attributes[name] = a
                emitNode(parser, "onattribute", a)
            }
            parser.attribList.length = 0
        }

        parser.tag.isSelfClosing = !!selfClosing

        // process the tag
        parser.sawRoot = true
        parser.tags.push(parser.tag)
        emitNode(parser, "onopentag", parser.tag)
        if (!selfClosing) {
            // special case for <script> in non-strict mode.
            if (!parser.noscript && parser.tagName.toLowerCase() === "script") {
                parser.state = S.SCRIPT
            } else {
                parser.state = S.TEXT
            }
            parser.tag = null
            parser.tagName = ""
        }
        parser.attribName = parser.attribValue = ""
        parser.attribList.length = 0
    }

    function closeTag(parser) {
        if (!parser.tagName) {
            strictFail(parser, "Weird empty close tag.")
            parser.textNode += "</>"
            parser.state = S.TEXT
            return
        }

        if (parser.script) {
            if (parser.tagName !== "script") {
                parser.script += "</" + parser.tagName + ">"
                parser.tagName = ""
                parser.state = S.SCRIPT
                return
            }
            emitNode(parser, "onscript", parser.script)
            parser.script = ""
        }

        // first make sure that the closing tag actually exists.
        // <a><b></c></b></a> will close everything, otherwise.
        var t = parser.tags.length
        var tagName = parser.tagName
        if (!parser.strict) tagName = tagName[parser.looseCase]()
        var closeTo = tagName
        while (t--) {
            var close = parser.tags[t]
            if (close.name !== closeTo) {
                // fail the first time in strict mode
                strictFail(parser, "Unexpected close tag")
            } else break
        }

        // didn't find it.  we already failed for strict, so just abort.
        if (t < 0) {
            strictFail(parser, "Unmatched closing tag: " + parser.tagName)
            parser.textNode += "</" + parser.tagName + ">"
            parser.state = S.TEXT
            return
        }
        parser.tagName = tagName
        var s = parser.tags.length
        while (s-- > t) {
            var tag = parser.tag = parser.tags.pop()
            parser.tagName = parser.tag.name
            emitNode(parser, "onclosetag", parser.tagName)

            var x = {}
            for (var i in tag.ns) x[i] = tag.ns[i]

            var parent = parser.tags[parser.tags.length - 1] || parser
            if (parser.opt.xmlns && tag.ns !== parent.ns) {
                // remove namespace bindings introduced by tag
                Object.keys(tag.ns).forEach(function (p) {
                    var n = tag.ns[p]
                    emitNode(parser, "onclosenamespace", { prefix: p, uri: n })
                })
            }
        }
        if (t === 0) parser.closedRoot = true
        parser.tagName = parser.attribValue = parser.attribName = ""
        parser.attribList.length = 0
        parser.state = S.TEXT
    }

    function parseEntity(parser) {
        var entity = parser.entity
          , entityLC = entity.toLowerCase()
          , num
          , numStr = ""
        if (parser.ENTITIES[entity])
            return parser.ENTITIES[entity]
        if (parser.ENTITIES[entityLC])
            return parser.ENTITIES[entityLC]
        entity = entityLC
        if (entity.charAt(0) === "#") {
            if (entity.charAt(1) === "x") {
                entity = entity.slice(2)
                num = parseInt(entity, 16)
                numStr = num.toString(16)
            } else {
                entity = entity.slice(1)
                num = parseInt(entity, 10)
                numStr = num.toString(10)
            }
        }
        entity = entity.replace(/^0+/, "")
        if (numStr.toLowerCase() !== entity) {
            strictFail(parser, "Invalid character entity")
            return "&" + parser.entity + ";"
        }

        return String.fromCodePoint(num)
    }

    function write(chunk) {
        var parser = this
        if (this.error) throw this.error
        if (parser.closed) return error(parser,
          "Cannot write after close. Assign an onready handler.")
        if (chunk === null) return end(parser)
        var i = 0, c = ""
        while (parser.c = c = chunk.charAt(i++)) {
            if (parser.trackPosition) {
                parser.position++
                if (c === "\n") {
                    parser.line++
                    parser.column = 0
                } else parser.column++
            }
            switch (parser.state) {

                case S.BEGIN:
                    if (c === "<") {
                        parser.state = S.OPEN_WAKA
                        parser.startTagPosition = parser.position
                    } else if (not(whitespace, c)) {
                        // have to process this as a text node.
                        // weird, but happens.
                        strictFail(parser, "Non-whitespace before first tag.")
                        parser.textNode = c
                        parser.state = S.TEXT
                    }
                    continue

                case S.TEXT:
                    if (parser.sawRoot && !parser.closedRoot) {
                        var starti = i - 1
                        while (c && c !== "<" && c !== "&") {
                            c = chunk.charAt(i++)
                            if (c && parser.trackPosition) {
                                parser.position++
                                if (c === "\n") {
                                    parser.line++
                                    parser.column = 0
                                } else parser.column++
                            }
                        }
                        parser.textNode += chunk.substring(starti, i - 1)
                    }
                    if (c === "<") {
                        parser.state = S.OPEN_WAKA
                        parser.startTagPosition = parser.position
                    } else {
                        if (not(whitespace, c) && (!parser.sawRoot || parser.closedRoot))
                            strictFail(parser, "Text data outside of root node.")
                        if (c === "&") parser.state = S.TEXT_ENTITY
                        else parser.textNode += c
                    }
                    continue

                case S.SCRIPT:
                    // only non-strict
                    if (c === "<") {
                        parser.state = S.SCRIPT_ENDING
                    } else parser.script += c
                    continue

                case S.SCRIPT_ENDING:
                    if (c === "/") {
                        parser.state = S.CLOSE_TAG
                    } else {
                        parser.script += "<" + c
                        parser.state = S.SCRIPT
                    }
                    continue

                case S.OPEN_WAKA:
                    // either a /, ?, !, or text is coming next.
                    if (c === "!") {
                        parser.state = S.SGML_DECL
                        parser.sgmlDecl = ""
                    } else if (is(whitespace, c)) {
                        // wait for it...
                    } else if (is(nameStart, c)) {
                        parser.state = S.OPEN_TAG
                        parser.tagName = c
                    } else if (c === "/") {
                        parser.state = S.CLOSE_TAG
                        parser.tagName = ""
                    } else if (c === "?") {
                        parser.state = S.PROC_INST
                        parser.procInstName = parser.procInstBody = ""
                    } else {
                        strictFail(parser, "Unencoded <")
                        // if there was some whitespace, then add that in.
                        if (parser.startTagPosition + 1 < parser.position) {
                            var pad = parser.position - parser.startTagPosition
                            c = new Array(pad).join(" ") + c
                        }
                        parser.textNode += "<" + c
                        parser.state = S.TEXT
                    }
                    continue

                case S.SGML_DECL:
                    if ((parser.sgmlDecl + c).toUpperCase() === CDATA) {
                        emitNode(parser, "onopencdata")
                        parser.state = S.CDATA
                        parser.sgmlDecl = ""
                        parser.cdata = ""
                    } else if (parser.sgmlDecl + c === "--") {
                        parser.state = S.COMMENT
                        parser.comment = ""
                        parser.sgmlDecl = ""
                    } else if ((parser.sgmlDecl + c).toUpperCase() === DOCTYPE) {
                        parser.state = S.DOCTYPE
                        if (parser.doctype || parser.sawRoot) strictFail(parser,
                          "Inappropriately located doctype declaration")
                        parser.doctype = ""
                        parser.sgmlDecl = ""
                    } else if (c === ">") {
                        emitNode(parser, "onsgmldeclaration", parser.sgmlDecl)
                        parser.sgmlDecl = ""
                        parser.state = S.TEXT
                    } else if (is(quote, c)) {
                        parser.state = S.SGML_DECL_QUOTED
                        parser.sgmlDecl += c
                    } else parser.sgmlDecl += c
                    continue

                case S.SGML_DECL_QUOTED:
                    if (c === parser.q) {
                        parser.state = S.SGML_DECL
                        parser.q = ""
                    }
                    parser.sgmlDecl += c
                    continue

                case S.DOCTYPE:
                    if (c === ">") {
                        parser.state = S.TEXT
                        emitNode(parser, "ondoctype", parser.doctype)
                        parser.doctype = true // just remember that we saw it.
                    } else {
                        parser.doctype += c
                        if (c === "[") parser.state = S.DOCTYPE_DTD
                        else if (is(quote, c)) {
                            parser.state = S.DOCTYPE_QUOTED
                            parser.q = c
                        }
                    }
                    continue

                case S.DOCTYPE_QUOTED:
                    parser.doctype += c
                    if (c === parser.q) {
                        parser.q = ""
                        parser.state = S.DOCTYPE
                    }
                    continue

                case S.DOCTYPE_DTD:
                    parser.doctype += c
                    if (c === "]") parser.state = S.DOCTYPE
                    else if (is(quote, c)) {
                        parser.state = S.DOCTYPE_DTD_QUOTED
                        parser.q = c
                    }
                    continue

                case S.DOCTYPE_DTD_QUOTED:
                    parser.doctype += c
                    if (c === parser.q) {
                        parser.state = S.DOCTYPE_DTD
                        parser.q = ""
                    }
                    continue

                case S.COMMENT:
                    if (c === "-") parser.state = S.COMMENT_ENDING
                    else parser.comment += c
                    continue

                case S.COMMENT_ENDING:
                    if (c === "-") {
                        parser.state = S.COMMENT_ENDED
                        parser.comment = textopts(parser.opt, parser.comment)
                        if (parser.comment) emitNode(parser, "oncomment", parser.comment)
                        parser.comment = ""
                    } else {
                        parser.comment += "-" + c
                        parser.state = S.COMMENT
                    }
                    continue

                case S.COMMENT_ENDED:
                    if (c !== ">") {
                        strictFail(parser, "Malformed comment")
                        // allow <!-- blah -- bloo --> in non-strict mode,
                        // which is a comment of " blah -- bloo "
                        parser.comment += "--" + c
                        parser.state = S.COMMENT
                    } else parser.state = S.TEXT
                    continue

                case S.CDATA:
                    if (c === "]") parser.state = S.CDATA_ENDING
                    else parser.cdata += c
                    continue

                case S.CDATA_ENDING:
                    if (c === "]") parser.state = S.CDATA_ENDING_2
                    else {
                        parser.cdata += "]" + c
                        parser.state = S.CDATA
                    }
                    continue

                case S.CDATA_ENDING_2:
                    if (c === ">") {
                        if (parser.cdata) emitNode(parser, "oncdata", parser.cdata)
                        emitNode(parser, "onclosecdata")
                        parser.cdata = ""
                        parser.state = S.TEXT
                    } else if (c === "]") {
                        parser.cdata += "]"
                    } else {
                        parser.cdata += "]]" + c
                        parser.state = S.CDATA
                    }
                    continue

                case S.PROC_INST:
                    if (c === "?") parser.state = S.PROC_INST_ENDING
                    else if (is(whitespace, c)) parser.state = S.PROC_INST_BODY
                    else parser.procInstName += c
                    continue

                case S.PROC_INST_BODY:
                    if (!parser.procInstBody && is(whitespace, c)) continue
                    else if (c === "?") parser.state = S.PROC_INST_ENDING
                    else parser.procInstBody += c
                    continue

                case S.PROC_INST_ENDING:
                    if (c === ">") {
                        emitNode(parser, "onprocessinginstruction", {
                            name: parser.procInstName,
                            body: parser.procInstBody
                        })
                        parser.procInstName = parser.procInstBody = ""
                        parser.state = S.TEXT
                    } else {
                        parser.procInstBody += "?" + c
                        parser.state = S.PROC_INST_BODY
                    }
                    continue

                case S.OPEN_TAG:
                    if (is(nameBody, c)) parser.tagName += c
                    else {
                        newTag(parser)
                        if (c === ">") openTag(parser)
                        else if (c === "/") parser.state = S.OPEN_TAG_SLASH
                        else {
                            if (not(whitespace, c)) strictFail(
                              parser, "Invalid character in tag name")
                            parser.state = S.ATTRIB
                        }
                    }
                    continue

                case S.OPEN_TAG_SLASH:
                    if (c === ">") {
                        openTag(parser, true)
                        closeTag(parser)
                    } else {
                        strictFail(parser, "Forward-slash in opening tag not followed by >")
                        parser.state = S.ATTRIB
                    }
                    continue

                case S.ATTRIB:
                    // haven't read the attribute name yet.
                    if (is(whitespace, c)) continue
                    else if (c === ">") openTag(parser)
                    else if (c === "/") parser.state = S.OPEN_TAG_SLASH
                    else if (is(nameStart, c)) {
                        parser.attribName = c
                        parser.attribValue = ""
                        parser.state = S.ATTRIB_NAME
                    } else strictFail(parser, "Invalid attribute name")
                    continue

                case S.ATTRIB_NAME:
                    if (c === "=") parser.state = S.ATTRIB_VALUE
                    else if (c === ">") {
                        strictFail(parser, "Attribute without value")
                        parser.attribValue = parser.attribName
                        attrib(parser)
                        openTag(parser)
                    }
                    else if (is(whitespace, c)) parser.state = S.ATTRIB_NAME_SAW_WHITE
                    else if (is(nameBody, c)) parser.attribName += c
                    else strictFail(parser, "Invalid attribute name")
                    continue

                case S.ATTRIB_NAME_SAW_WHITE:
                    if (c === "=") parser.state = S.ATTRIB_VALUE
                    else if (is(whitespace, c)) continue
                    else {
                        strictFail(parser, "Attribute without value")
                        parser.tag.attributes[parser.attribName] = ""
                        parser.attribValue = ""
                        emitNode(parser, "onattribute",
                                 { name: parser.attribName, value: "" })
                        parser.attribName = ""
                        if (c === ">") openTag(parser)
                        else if (is(nameStart, c)) {
                            parser.attribName = c
                            parser.state = S.ATTRIB_NAME
                        } else {
                            strictFail(parser, "Invalid attribute name")
                            parser.state = S.ATTRIB
                        }
                    }
                    continue

                case S.ATTRIB_VALUE:
                    if (is(whitespace, c)) continue
                    else if (is(quote, c)) {
                        parser.q = c
                        parser.state = S.ATTRIB_VALUE_QUOTED
                    } else {
                        strictFail(parser, "Unquoted attribute value")
                        parser.state = S.ATTRIB_VALUE_UNQUOTED
                        parser.attribValue = c
                    }
                    continue

                case S.ATTRIB_VALUE_QUOTED:
                    if (c !== parser.q) {
                        if (c === "&") parser.state = S.ATTRIB_VALUE_ENTITY_Q
                        else parser.attribValue += c
                        continue
                    }
                    attrib(parser)
                    parser.q = ""
                    parser.state = S.ATTRIB_VALUE_CLOSED
                    continue

                case S.ATTRIB_VALUE_CLOSED:
                    if (is(whitespace, c)) {
                        parser.state = S.ATTRIB
                    } else if (c === ">") openTag(parser)
                    else if (c === "/") parser.state = S.OPEN_TAG_SLASH
                    else if (is(nameStart, c)) {
                        strictFail(parser, "No whitespace between attributes")
                        parser.attribName = c
                        parser.attribValue = ""
                        parser.state = S.ATTRIB_NAME
                    } else strictFail(parser, "Invalid attribute name")
                    continue

                case S.ATTRIB_VALUE_UNQUOTED:
                    if (not(attribEnd, c)) {
                        if (c === "&") parser.state = S.ATTRIB_VALUE_ENTITY_U
                        else parser.attribValue += c
                        continue
                    }
                    attrib(parser)
                    if (c === ">") openTag(parser)
                    else parser.state = S.ATTRIB
                    continue

                case S.CLOSE_TAG:
                    if (!parser.tagName) {
                        if (is(whitespace, c)) continue
                        else if (not(nameStart, c)) {
                            if (parser.script) {
                                parser.script += "</" + c
                                parser.state = S.SCRIPT
                            } else {
                                strictFail(parser, "Invalid tagname in closing tag.")
                            }
                        } else parser.tagName = c
                    }
                    else if (c === ">") closeTag(parser)
                    else if (is(nameBody, c)) parser.tagName += c
                    else if (parser.script) {
                        parser.script += "</" + parser.tagName
                        parser.tagName = ""
                        parser.state = S.SCRIPT
                    } else {
                        if (not(whitespace, c)) strictFail(parser,
                          "Invalid tagname in closing tag")
                        parser.state = S.CLOSE_TAG_SAW_WHITE
                    }
                    continue

                case S.CLOSE_TAG_SAW_WHITE:
                    if (is(whitespace, c)) continue
                    if (c === ">") closeTag(parser)
                    else strictFail(parser, "Invalid characters in closing tag")
                    continue

                case S.TEXT_ENTITY:
                case S.ATTRIB_VALUE_ENTITY_Q:
                case S.ATTRIB_VALUE_ENTITY_U:
                    switch (parser.state) {
                        case S.TEXT_ENTITY:
                            var returnState = S.TEXT, buffer = "textNode"
                            break

                        case S.ATTRIB_VALUE_ENTITY_Q:
                            var returnState = S.ATTRIB_VALUE_QUOTED, buffer = "attribValue"
                            break

                        case S.ATTRIB_VALUE_ENTITY_U:
                            var returnState = S.ATTRIB_VALUE_UNQUOTED, buffer = "attribValue"
                            break
                    }
                    if (c === ";") {
                        parser[buffer] += parseEntity(parser)
                        parser.entity = ""
                        parser.state = returnState
                    }
                    else if (is(entity, c)) parser.entity += c
                    else {
                        strictFail(parser, "Invalid character entity")
                        parser[buffer] += "&" + parser.entity + c
                        parser.entity = ""
                        parser.state = returnState
                    }
                    continue

                default:
                    throw new Error(parser, "Unknown state: " + parser.state)
            }
        } // while
        // cdata blocks can get very big under normal conditions. emit and move on.
        // if (parser.state === S.CDATA && parser.cdata) {
        //   emitNode(parser, "oncdata", parser.cdata)
        //   parser.cdata = ""
        // }
        if (parser.position >= parser.bufferCheckPosition) checkBufferLength(parser)
        return parser
    }

    /* http://mths.be/fromcodepoint v0.1.0 by @mathias */
    if (!String.fromCodePoint) {
        (function () {
            var stringFromCharCode = String.fromCharCode;
            var floor = Math.floor;
            var fromCodePoint = function () {
                var MAX_SIZE = 0x4000;
                var codeUnits = [];
                var highSurrogate;
                var lowSurrogate;
                var index = -1;
                var length = arguments.length;
                if (!length) {
                    return '';
                }
                var result = '';
                while (++index < length) {
                    var codePoint = Number(arguments[index]);
                    if (
                            !isFinite(codePoint) || // `NaN`, `+Infinity`, or `-Infinity`
                            codePoint < 0 || // not a valid Unicode code point
                            codePoint > 0x10FFFF || // not a valid Unicode code point
                            floor(codePoint) != codePoint // not an integer
                    ) {
                        throw RangeError('Invalid code point: ' + codePoint);
                    }
                    if (codePoint <= 0xFFFF) { // BMP code point
                        codeUnits.push(codePoint);
                    } else { // Astral code point; split in surrogate halves
                        // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
                        codePoint -= 0x10000;
                        highSurrogate = (codePoint >> 10) + 0xD800;
                        lowSurrogate = (codePoint % 0x400) + 0xDC00;
                        codeUnits.push(highSurrogate, lowSurrogate);
                    }
                    if (index + 1 == length || codeUnits.length > MAX_SIZE) {
                        result += stringFromCharCode.apply(null, codeUnits);
                        codeUnits.length = 0;
                    }
                }
                return result;
            };
            if (Object.defineProperty) {
                Object.defineProperty(String, 'fromCodePoint', {
                    'value': fromCodePoint,
                    'configurable': true,
                    'writable': true
                });
            } else {
                String.fromCodePoint = fromCodePoint;
            }
        }());
    }

})(typeof exports === "undefined" ? sax = {} : exports);/*--------------------------------------------------------------------------
 * linq.js - LINQ for JavaScript
 * ver 3.0.3-Beta4 (Oct. 9th, 2012)
 *
 * created and maintained by neuecc <ils@neue.cc>
 * licensed under MIT License
 * http://linqjs.codeplex.com/
 *------------------------------------------------------------------------*/

(function (root, undefined) {
    // ReadOnly Function
    var Functions = {
        Identity: function (x) { return x; },
        True: function () { return true; },
        Blank: function () { }
    };

    // const Type
    var Types = {
        Boolean: typeof true,
        Number: typeof 0,
        String: typeof "",
        Object: typeof {},
        Undefined: typeof undefined,
        Function: typeof function () { }
    };

    // private utility methods
    var Utils = {
        // Create anonymous function from lambda expression string
        createLambda: function (expression) {
            if (expression == null) return Functions.Identity;
            if (typeof expression == Types.String) {
                if (expression == "") {
                    return Functions.Identity;
                }
                else if (expression.indexOf("=>") == -1) {
                    var regexp = new RegExp("[$]+", "g");

                    var maxLength = 0;
                    var match;
                    while (match = regexp.exec(expression)) {
                        var paramNumber = match[0].length;
                        if (paramNumber > maxLength) {
                            maxLength = paramNumber;
                        }
                    }

                    var argArray = [];
                    for (var i = 1; i <= maxLength; i++) {
                        var dollar = "";
                        for (var j = 0; j < i; j++) {
                            dollar += "$";
                        }
                        argArray.push(dollar);
                    }

                    var args = Array.prototype.join.call(argArray, ",");

                    return new Function(args, "return " + expression);
                }
                else {
                    var expr = expression.match(/^[(\s]*([^()]*?)[)\s]*=>(.*)/);
                    return new Function(expr[1], "return " + expr[2]);
                }
            }
            return expression;
        },

        isIEnumerable: function (obj) {
            if (typeof Enumerator !== Types.Undefined) {
                try {
                    new Enumerator(obj); // check JScript(IE)'s Enumerator
                    return true;
                }
                catch (e) { }
            }

            return false;
        },

        // IE8's defineProperty is defined but cannot use, therefore check defineProperties
        defineProperty: (Object.defineProperties != null)
            ? function (target, methodName, value) {
                Object.defineProperty(target, methodName, {
                    enumerable: false,
                    configurable: true,
                    writable: true,
                    value: value
                })
            }
            : function (target, methodName, value) {
                target[methodName] = value;
            },

        compare: function (a, b) {
            return (a === b) ? 0
                 : (a > b) ? 1
                 : -1;
        },

        dispose: function (obj) {
            if (obj != null) obj.dispose();
        }
    };

    // IEnumerator State
    var State = { Before: 0, Running: 1, After: 2 };

    // "Enumerator" is conflict JScript's "Enumerator"
    var IEnumerator = function (initialize, tryGetNext, dispose) {
        var yielder = new Yielder();
        var state = State.Before;

        this.current = yielder.current;

        this.moveNext = function () {
            try {
                switch (state) {
                    case State.Before:
                        state = State.Running;
                        initialize();
                        // fall through
                    case State.Running:
                        if (tryGetNext.apply(yielder)) {
                            return true;
                        }
                        else {
                            this.dispose();
                            return false;
                        }
                    case State.After:
                        return false;
                }
            }
            catch (e) {
                this.dispose();
                throw e;
            }
        };

        this.dispose = function () {
            if (state != State.Running) return;

            try {
                dispose();
            }
            finally {
                state = State.After;
            }
        };
    };

    // for tryGetNext
    var Yielder = function () {
        var current = null;
        this.current = function () { return current; };
        this.yieldReturn = function (value) {
            current = value;
            return true;
        };
        this.yieldBreak = function () {
            return false;
        };
    };

    // Enumerable constuctor
    var Enumerable = function (getEnumerator) {
        this.getEnumerator = getEnumerator;
    };

    // Utility

    Enumerable.Utils = {}; // container

    Enumerable.Utils.createLambda = function (expression) {
        return Utils.createLambda(expression);
    };

    Enumerable.Utils.createEnumerable = function (getEnumerator) {
        return new Enumerable(getEnumerator);
    };

    Enumerable.Utils.createEnumerator = function (initialize, tryGetNext, dispose) {
        return new IEnumerator(initialize, tryGetNext, dispose);
    };

    Enumerable.Utils.extendTo = function (type) {
        var typeProto = type.prototype;
        var enumerableProto;

        if (type === Array) {
            enumerableProto = ArrayEnumerable.prototype;
            Utils.defineProperty(typeProto, "getSource", function () {
                return this;
            });
        }
        else {
            enumerableProto = Enumerable.prototype;
            Utils.defineProperty(typeProto, "getEnumerator", function () {
                return Enumerable.from(this).getEnumerator();
            });
        }

        for (var methodName in enumerableProto) {
            var func = enumerableProto[methodName];

            // already extended
            if (typeProto[methodName] == func) continue;

            // already defined(example Array#reverse/join/forEach...)
            if (typeProto[methodName] != null) {
                methodName = methodName + "ByLinq";
                if (typeProto[methodName] == func) continue; // recheck
            }

            if (func instanceof Function) {
                Utils.defineProperty(typeProto, methodName, func);
            }
        }
    };

    // Generator

    Enumerable.choice = function () // variable argument
    {
        var args = arguments;

        return new Enumerable(function () {
            return new IEnumerator(
                function () {
                    args = (args[0] instanceof Array) ? args[0]
                        : (args[0].getEnumerator != null) ? args[0].toArray()
                        : args;
                },
                function () {
                    return this.yieldReturn(args[Math.floor(Math.random() * args.length)]);
                },
                Functions.Blank);
        });
    };

    Enumerable.cycle = function () // variable argument
    {
        var args = arguments;

        return new Enumerable(function () {
            var index = 0;
            return new IEnumerator(
                function () {
                    args = (args[0] instanceof Array) ? args[0]
                        : (args[0].getEnumerator != null) ? args[0].toArray()
                        : args;
                },
                function () {
                    if (index >= args.length) index = 0;
                    return this.yieldReturn(args[index++]);
                },
                Functions.Blank);
        });
    };

    Enumerable.empty = function () {
        return new Enumerable(function () {
            return new IEnumerator(
                Functions.Blank,
                function () { return false; },
                Functions.Blank);
        });
    };

    Enumerable.from = function (obj) {
        if (obj == null) {
            return Enumerable.empty();
        }
        if (obj instanceof Enumerable) {
            return obj;
        }
        if (typeof obj == Types.Number || typeof obj == Types.Boolean) {
            return Enumerable.repeat(obj, 1);
        }
        if (typeof obj == Types.String) {
            return new Enumerable(function () {
                var index = 0;
                return new IEnumerator(
                    Functions.Blank,
                    function () {
                        return (index < obj.length) ? this.yieldReturn(obj.charAt(index++)) : false;
                    },
                    Functions.Blank);
            });
        }
        if (typeof obj != Types.Function) {
            // array or array like object
            if (typeof obj.length == Types.Number) {
                return new ArrayEnumerable(obj);
            }

            // JScript's IEnumerable
            if (!(obj instanceof Object) && Utils.isIEnumerable(obj)) {
                return new Enumerable(function () {
                    var isFirst = true;
                    var enumerator;
                    return new IEnumerator(
                        function () { enumerator = new Enumerator(obj); },
                        function () {
                            if (isFirst) isFirst = false;
                            else enumerator.moveNext();

                            return (enumerator.atEnd()) ? false : this.yieldReturn(enumerator.item());
                        },
                        Functions.Blank);
                });
            }

            // WinMD IIterable<T>
            if (typeof Windows === Types.Object && typeof obj.first === Types.Function) {
                return new Enumerable(function () {
                    var isFirst = true;
                    var enumerator;
                    return new IEnumerator(
                        function () { enumerator = obj.first(); },
                        function () {
                            if (isFirst) isFirst = false;
                            else enumerator.moveNext();

                            return (enumerator.hasCurrent) ? this.yieldReturn(enumerator.current) : this.yieldBreak();
                        },
                        Functions.Blank);
                });
            }
        }

        // case function/object : Create keyValuePair[]
        return new Enumerable(function () {
            var array = [];
            var index = 0;

            return new IEnumerator(
                function () {
                    for (var key in obj) {
                        var value = obj[key];
                        if (!(value instanceof Function) && Object.prototype.hasOwnProperty.call(obj, key)) {
                            array.push({ key: key, value: value });
                        }
                    }
                },
                function () {
                    return (index < array.length)
                        ? this.yieldReturn(array[index++])
                        : false;
                },
                Functions.Blank);
        });
    },

    Enumerable.make = function (element) {
        return Enumerable.repeat(element, 1);
    };

    // Overload:function(input, pattern)
    // Overload:function(input, pattern, flags)
    Enumerable.matches = function (input, pattern, flags) {
        if (flags == null) flags = "";
        if (pattern instanceof RegExp) {
            flags += (pattern.ignoreCase) ? "i" : "";
            flags += (pattern.multiline) ? "m" : "";
            pattern = pattern.source;
        }
        if (flags.indexOf("g") === -1) flags += "g";

        return new Enumerable(function () {
            var regex;
            return new IEnumerator(
                function () { regex = new RegExp(pattern, flags); },
                function () {
                    var match = regex.exec(input);
                    return (match) ? this.yieldReturn(match) : false;
                },
                Functions.Blank);
        });
    };

    // Overload:function(start, count)
    // Overload:function(start, count, step)
    Enumerable.range = function (start, count, step) {
        if (step == null) step = 1;

        return new Enumerable(function () {
            var value;
            var index = 0;

            return new IEnumerator(
                function () { value = start - step; },
                function () {
                    return (index++ < count)
                        ? this.yieldReturn(value += step)
                        : this.yieldBreak();
                },
                Functions.Blank);
        });
    };

    // Overload:function(start, count)
    // Overload:function(start, count, step)
    Enumerable.rangeDown = function (start, count, step) {
        if (step == null) step = 1;

        return new Enumerable(function () {
            var value;
            var index = 0;

            return new IEnumerator(
                function () { value = start + step; },
                function () {
                    return (index++ < count)
                        ? this.yieldReturn(value -= step)
                        : this.yieldBreak();
                },
                Functions.Blank);
        });
    };

    // Overload:function(start, to)
    // Overload:function(start, to, step)
    Enumerable.rangeTo = function (start, to, step) {
        if (step == null) step = 1;

        if (start < to) {
            return new Enumerable(function () {
                var value;

                return new IEnumerator(
                function () { value = start - step; },
                function () {
                    var next = value += step;
                    return (next <= to)
                        ? this.yieldReturn(next)
                        : this.yieldBreak();
                },
                Functions.Blank);
            });
        }
        else {
            return new Enumerable(function () {
                var value;

                return new IEnumerator(
                function () { value = start + step; },
                function () {
                    var next = value -= step;
                    return (next >= to)
                        ? this.yieldReturn(next)
                        : this.yieldBreak();
                },
                Functions.Blank);
            });
        }
    };

    // Overload:function(element)
    // Overload:function(element, count)
    Enumerable.repeat = function (element, count) {
        if (count != null) return Enumerable.repeat(element).take(count);

        return new Enumerable(function () {
            return new IEnumerator(
                Functions.Blank,
                function () { return this.yieldReturn(element); },
                Functions.Blank);
        });
    };

    Enumerable.repeatWithFinalize = function (initializer, finalizer) {
        initializer = Utils.createLambda(initializer);
        finalizer = Utils.createLambda(finalizer);

        return new Enumerable(function () {
            var element;
            return new IEnumerator(
                function () { element = initializer(); },
                function () { return this.yieldReturn(element); },
                function () {
                    if (element != null) {
                        finalizer(element);
                        element = null;
                    }
                });
        });
    };

    // Overload:function(func)
    // Overload:function(func, count)
    Enumerable.generate = function (func, count) {
        if (count != null) return Enumerable.generate(func).take(count);
        func = Utils.createLambda(func);

        return new Enumerable(function () {
            return new IEnumerator(
                Functions.Blank,
                function () { return this.yieldReturn(func()); },
                Functions.Blank);
        });
    };

    // Overload:function()
    // Overload:function(start)
    // Overload:function(start, step)
    Enumerable.toInfinity = function (start, step) {
        if (start == null) start = 0;
        if (step == null) step = 1;

        return new Enumerable(function () {
            var value;
            return new IEnumerator(
                function () { value = start - step; },
                function () { return this.yieldReturn(value += step); },
                Functions.Blank);
        });
    };

    // Overload:function()
    // Overload:function(start)
    // Overload:function(start, step)
    Enumerable.toNegativeInfinity = function (start, step) {
        if (start == null) start = 0;
        if (step == null) step = 1;

        return new Enumerable(function () {
            var value;
            return new IEnumerator(
                function () { value = start + step; },
                function () { return this.yieldReturn(value -= step); },
                Functions.Blank);
        });
    };

    Enumerable.unfold = function (seed, func) {
        func = Utils.createLambda(func);

        return new Enumerable(function () {
            var isFirst = true;
            var value;
            return new IEnumerator(
                Functions.Blank,
                function () {
                    if (isFirst) {
                        isFirst = false;
                        value = seed;
                        return this.yieldReturn(value);
                    }
                    value = func(value);
                    return this.yieldReturn(value);
                },
                Functions.Blank);
        });
    };

    Enumerable.defer = function (enumerableFactory) {

        return new Enumerable(function () {
            var enumerator;

            return new IEnumerator(
                function () { enumerator = Enumerable.from(enumerableFactory()).getEnumerator(); },
                function () {
                    return (enumerator.moveNext())
                        ? this.yieldReturn(enumerator.current())
                        : this.yieldBreak();
                },
                function () {
                    Utils.dispose(enumerator);
                });
        });
    };

    // Extension Methods

    /* Projection and Filtering Methods */

    // Overload:function(func)
    // Overload:function(func, resultSelector<element>)
    // Overload:function(func, resultSelector<element, nestLevel>)
    Enumerable.prototype.traverseBreadthFirst = function (func, resultSelector) {
        var source = this;
        func = Utils.createLambda(func);
        resultSelector = Utils.createLambda(resultSelector);

        return new Enumerable(function () {
            var enumerator;
            var nestLevel = 0;
            var buffer = [];

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    while (true) {
                        if (enumerator.moveNext()) {
                            buffer.push(enumerator.current());
                            return this.yieldReturn(resultSelector(enumerator.current(), nestLevel));
                        }

                        var next = Enumerable.from(buffer).selectMany(function (x) { return func(x); });
                        if (!next.any()) {
                            return false;
                        }
                        else {
                            nestLevel++;
                            buffer = [];
                            Utils.dispose(enumerator);
                            enumerator = next.getEnumerator();
                        }
                    }
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    // Overload:function(func)
    // Overload:function(func, resultSelector<element>)
    // Overload:function(func, resultSelector<element, nestLevel>)
    Enumerable.prototype.traverseDepthFirst = function (func, resultSelector) {
        var source = this;
        func = Utils.createLambda(func);
        resultSelector = Utils.createLambda(resultSelector);

        return new Enumerable(function () {
            var enumeratorStack = [];
            var enumerator;

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    while (true) {
                        if (enumerator.moveNext()) {
                            var value = resultSelector(enumerator.current(), enumeratorStack.length);
                            enumeratorStack.push(enumerator);
                            enumerator = Enumerable.from(func(enumerator.current())).getEnumerator();
                            return this.yieldReturn(value);
                        }

                        if (enumeratorStack.length <= 0) return false;
                        Utils.dispose(enumerator);
                        enumerator = enumeratorStack.pop();
                    }
                },
                function () {
                    try {
                        Utils.dispose(enumerator);
                    }
                    finally {
                        Enumerable.from(enumeratorStack).forEach(function (s) { s.dispose(); });
                    }
                });
        });
    };

    Enumerable.prototype.flatten = function () {
        var source = this;

        return new Enumerable(function () {
            var enumerator;
            var middleEnumerator = null;

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    while (true) {
                        if (middleEnumerator != null) {
                            if (middleEnumerator.moveNext()) {
                                return this.yieldReturn(middleEnumerator.current());
                            }
                            else {
                                middleEnumerator = null;
                            }
                        }

                        if (enumerator.moveNext()) {
                            if (enumerator.current() instanceof Array) {
                                Utils.dispose(middleEnumerator);
                                middleEnumerator = Enumerable.from(enumerator.current())
                                    .selectMany(Functions.Identity)
                                    .flatten()
                                    .getEnumerator();
                                continue;
                            }
                            else {
                                return this.yieldReturn(enumerator.current());
                            }
                        }

                        return false;
                    }
                },
                function () {
                    try {
                        Utils.dispose(enumerator);
                    }
                    finally {
                        Utils.dispose(middleEnumerator);
                    }
                });
        });
    };

    Enumerable.prototype.pairwise = function (selector) {
        var source = this;
        selector = Utils.createLambda(selector);

        return new Enumerable(function () {
            var enumerator;

            return new IEnumerator(
                function () {
                    enumerator = source.getEnumerator();
                    enumerator.moveNext();
                },
                function () {
                    var prev = enumerator.current();
                    return (enumerator.moveNext())
                        ? this.yieldReturn(selector(prev, enumerator.current()))
                        : false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    // Overload:function(func)
    // Overload:function(seed,func<value,element>)
    Enumerable.prototype.scan = function (seed, func) {
        var isUseSeed;
        if (func == null) {
            func = Utils.createLambda(seed); // arguments[0]
            isUseSeed = false;
        } else {
            func = Utils.createLambda(func);
            isUseSeed = true;
        }
        var source = this;

        return new Enumerable(function () {
            var enumerator;
            var value;
            var isFirst = true;

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    if (isFirst) {
                        isFirst = false;
                        if (!isUseSeed) {
                            if (enumerator.moveNext()) {
                                return this.yieldReturn(value = enumerator.current());
                            }
                        }
                        else {
                            return this.yieldReturn(value = seed);
                        }
                    }

                    return (enumerator.moveNext())
                        ? this.yieldReturn(value = func(value, enumerator.current()))
                        : false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    // Overload:function(selector<element>)
    // Overload:function(selector<element,index>)
    Enumerable.prototype.select = function (selector) {
        selector = Utils.createLambda(selector);

        if (selector.length <= 1) {
            return new WhereSelectEnumerable(this, null, selector);
        }
        else {
            var source = this;

            return new Enumerable(function () {
                var enumerator;
                var index = 0;

                return new IEnumerator(
                    function () { enumerator = source.getEnumerator(); },
                    function () {
                        return (enumerator.moveNext())
                            ? this.yieldReturn(selector(enumerator.current(), index++))
                            : false;
                    },
                    function () { Utils.dispose(enumerator); });
            });
        }
    };

    // Overload:function(collectionSelector<element>)
    // Overload:function(collectionSelector<element,index>)
    // Overload:function(collectionSelector<element>,resultSelector)
    // Overload:function(collectionSelector<element,index>,resultSelector)
    Enumerable.prototype.selectMany = function (collectionSelector, resultSelector) {
        var source = this;
        collectionSelector = Utils.createLambda(collectionSelector);
        if (resultSelector == null) resultSelector = function (a, b) { return b; };
        resultSelector = Utils.createLambda(resultSelector);

        return new Enumerable(function () {
            var enumerator;
            var middleEnumerator = undefined;
            var index = 0;

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    if (middleEnumerator === undefined) {
                        if (!enumerator.moveNext()) return false;
                    }
                    do {
                        if (middleEnumerator == null) {
                            var middleSeq = collectionSelector(enumerator.current(), index++);
                            middleEnumerator = Enumerable.from(middleSeq).getEnumerator();
                        }
                        if (middleEnumerator.moveNext()) {
                            return this.yieldReturn(resultSelector(enumerator.current(), middleEnumerator.current()));
                        }
                        Utils.dispose(middleEnumerator);
                        middleEnumerator = null;
                    } while (enumerator.moveNext());
                    return false;
                },
                function () {
                    try {
                        Utils.dispose(enumerator);
                    }
                    finally {
                        Utils.dispose(middleEnumerator);
                    }
                });
        });
    };

    // Overload:function(predicate<element>)
    // Overload:function(predicate<element,index>)
    Enumerable.prototype.where = function (predicate) {
        predicate = Utils.createLambda(predicate);

        if (predicate.length <= 1) {
            return new WhereEnumerable(this, predicate);
        }
        else {
            var source = this;

            return new Enumerable(function () {
                var enumerator;
                var index = 0;

                return new IEnumerator(
                    function () { enumerator = source.getEnumerator(); },
                    function () {
                        while (enumerator.moveNext()) {
                            if (predicate(enumerator.current(), index++)) {
                                return this.yieldReturn(enumerator.current());
                            }
                        }
                        return false;
                    },
                    function () { Utils.dispose(enumerator); });
            });
        }
    };


    // Overload:function(selector<element>)
    // Overload:function(selector<element,index>)
    Enumerable.prototype.choose = function (selector) {
        selector = Utils.createLambda(selector);
        var source = this;

        return new Enumerable(function () {
            var enumerator;
            var index = 0;

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    while (enumerator.moveNext()) {
                        var result = selector(enumerator.current(), index++);
                        if (result != null) {
                            return this.yieldReturn(result);
                        }
                    }
                    return this.yieldBreak();
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    Enumerable.prototype.ofType = function (type) {
        var typeName;
        switch (type) {
            case Number:
                typeName = Types.Number;
                break;
            case String:
                typeName = Types.String;
                break;
            case Boolean:
                typeName = Types.Boolean;
                break;
            case Function:
                typeName = Types.Function;
                break;
            default:
                typeName = null;
                break;
        }
        return (typeName === null)
            ? this.where(function (x) { return x instanceof type; })
            : this.where(function (x) { return typeof x === typeName; });
    };

    // mutiple arguments, last one is selector, others are enumerable
    Enumerable.prototype.zip = function () {
        var args = arguments;
        var selector = Utils.createLambda(arguments[arguments.length - 1]);

        var source = this;
        // optimized case:argument is 2
        if (arguments.length == 2) {
            var second = arguments[0];

            return new Enumerable(function () {
                var firstEnumerator;
                var secondEnumerator;
                var index = 0;

                return new IEnumerator(
                function () {
                    firstEnumerator = source.getEnumerator();
                    secondEnumerator = Enumerable.from(second).getEnumerator();
                },
                function () {
                    if (firstEnumerator.moveNext() && secondEnumerator.moveNext()) {
                        return this.yieldReturn(selector(firstEnumerator.current(), secondEnumerator.current(), index++));
                    }
                    return false;
                },
                function () {
                    try {
                        Utils.dispose(firstEnumerator);
                    } finally {
                        Utils.dispose(secondEnumerator);
                    }
                });
            });
        }
        else {
            return new Enumerable(function () {
                var enumerators;
                var index = 0;

                return new IEnumerator(
                function () {
                    var array = Enumerable.make(source)
                        .concat(Enumerable.from(args).takeExceptLast().select(Enumerable.from))
                        .select(function (x) { return x.getEnumerator() })
                        .toArray();
                    enumerators = Enumerable.from(array);
                },
                function () {
                    if (enumerators.all(function (x) { return x.moveNext() })) {
                        var array = enumerators
                            .select(function (x) { return x.current() })
                            .toArray();
                        array.push(index++);
                        return this.yieldReturn(selector.apply(null, array));
                    }
                    else {
                        return this.yieldBreak();
                    }
                },
                function () {
                    Enumerable.from(enumerators).forEach(Utils.dispose);
                });
            });
        }
    };

    // mutiple arguments
    Enumerable.prototype.merge = function () {
        var args = arguments;
        var source = this;

        return new Enumerable(function () {
            var enumerators;
            var index = -1;

            return new IEnumerator(
                function () {
                    enumerators = Enumerable.make(source)
                        .concat(Enumerable.from(args).select(Enumerable.from))
                        .select(function (x) { return x.getEnumerator() })
                        .toArray();
                },
                function () {
                    while (enumerators.length > 0) {
                        index = (index >= enumerators.length - 1) ? 0 : index + 1;
                        var enumerator = enumerators[index];

                        if (enumerator.moveNext()) {
                            return this.yieldReturn(enumerator.current());
                        }
                        else {
                            enumerator.dispose();
                            enumerators.splice(index--, 1);
                        }
                    }
                    return this.yieldBreak();
                },
                function () {
                    Enumerable.from(enumerators).forEach(Utils.dispose);
                });
        });
    };

    /* Join Methods */

    // Overload:function (inner, outerKeySelector, innerKeySelector, resultSelector)
    // Overload:function (inner, outerKeySelector, innerKeySelector, resultSelector, compareSelector)
    Enumerable.prototype.join = function (inner, outerKeySelector, innerKeySelector, resultSelector, compareSelector) {
        outerKeySelector = Utils.createLambda(outerKeySelector);
        innerKeySelector = Utils.createLambda(innerKeySelector);
        resultSelector = Utils.createLambda(resultSelector);
        compareSelector = Utils.createLambda(compareSelector);
        var source = this;

        return new Enumerable(function () {
            var outerEnumerator;
            var lookup;
            var innerElements = null;
            var innerCount = 0;

            return new IEnumerator(
                function () {
                    outerEnumerator = source.getEnumerator();
                    lookup = Enumerable.from(inner).toLookup(innerKeySelector, Functions.Identity, compareSelector);
                },
                function () {
                    while (true) {
                        if (innerElements != null) {
                            var innerElement = innerElements[innerCount++];
                            if (innerElement !== undefined) {
                                return this.yieldReturn(resultSelector(outerEnumerator.current(), innerElement));
                            }

                            innerElement = null;
                            innerCount = 0;
                        }

                        if (outerEnumerator.moveNext()) {
                            var key = outerKeySelector(outerEnumerator.current());
                            innerElements = lookup.get(key).toArray();
                        } else {
                            return false;
                        }
                    }
                },
                function () { Utils.dispose(outerEnumerator); });
        });
    };

    // Overload:function (inner, outerKeySelector, innerKeySelector, resultSelector)
    // Overload:function (inner, outerKeySelector, innerKeySelector, resultSelector, compareSelector)
    Enumerable.prototype.groupJoin = function (inner, outerKeySelector, innerKeySelector, resultSelector, compareSelector) {
        outerKeySelector = Utils.createLambda(outerKeySelector);
        innerKeySelector = Utils.createLambda(innerKeySelector);
        resultSelector = Utils.createLambda(resultSelector);
        compareSelector = Utils.createLambda(compareSelector);
        var source = this;

        return new Enumerable(function () {
            var enumerator = source.getEnumerator();
            var lookup = null;

            return new IEnumerator(
                function () {
                    enumerator = source.getEnumerator();
                    lookup = Enumerable.from(inner).toLookup(innerKeySelector, Functions.Identity, compareSelector);
                },
                function () {
                    if (enumerator.moveNext()) {
                        var innerElement = lookup.get(outerKeySelector(enumerator.current()));
                        return this.yieldReturn(resultSelector(enumerator.current(), innerElement));
                    }
                    return false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    /* Set Methods */

    Enumerable.prototype.all = function (predicate) {
        predicate = Utils.createLambda(predicate);

        var result = true;
        this.forEach(function (x) {
            if (!predicate(x)) {
                result = false;
                return false; // break
            }
        });
        return result;
    };

    // Overload:function()
    // Overload:function(predicate)
    Enumerable.prototype.any = function (predicate) {
        predicate = Utils.createLambda(predicate);

        var enumerator = this.getEnumerator();
        try {
            if (arguments.length == 0) return enumerator.moveNext(); // case:function()

            while (enumerator.moveNext()) // case:function(predicate)
            {
                if (predicate(enumerator.current())) return true;
            }
            return false;
        }
        finally {
            Utils.dispose(enumerator);
        }
    };

    Enumerable.prototype.isEmpty = function () {
        return !this.any();
    };

    // multiple arguments
    Enumerable.prototype.concat = function () {
        var source = this;

        if (arguments.length == 1) {
            var second = arguments[0];

            return new Enumerable(function () {
                var firstEnumerator;
                var secondEnumerator;

                return new IEnumerator(
                function () { firstEnumerator = source.getEnumerator(); },
                function () {
                    if (secondEnumerator == null) {
                        if (firstEnumerator.moveNext()) return this.yieldReturn(firstEnumerator.current());
                        secondEnumerator = Enumerable.from(second).getEnumerator();
                    }
                    if (secondEnumerator.moveNext()) return this.yieldReturn(secondEnumerator.current());
                    return false;
                },
                function () {
                    try {
                        Utils.dispose(firstEnumerator);
                    }
                    finally {
                        Utils.dispose(secondEnumerator);
                    }
                });
            });
        }
        else {
            var args = arguments;

            return new Enumerable(function () {
                var enumerators;

                return new IEnumerator(
                    function () {
                        enumerators = Enumerable.make(source)
                            .concat(Enumerable.from(args).select(Enumerable.from))
                            .select(function (x) { return x.getEnumerator() })
                            .toArray();
                    },
                    function () {
                        while (enumerators.length > 0) {
                            var enumerator = enumerators[0];

                            if (enumerator.moveNext()) {
                                return this.yieldReturn(enumerator.current());
                            }
                            else {
                                enumerator.dispose();
                                enumerators.splice(0, 1);
                            }
                        }
                        return this.yieldBreak();
                    },
                    function () {
                        Enumerable.from(enumerators).forEach(Utils.dispose);
                    });
            });
        }
    };

    Enumerable.prototype.insert = function (index, second) {
        var source = this;

        return new Enumerable(function () {
            var firstEnumerator;
            var secondEnumerator;
            var count = 0;
            var isEnumerated = false;

            return new IEnumerator(
                function () {
                    firstEnumerator = source.getEnumerator();
                    secondEnumerator = Enumerable.from(second).getEnumerator();
                },
                function () {
                    if (count == index && secondEnumerator.moveNext()) {
                        isEnumerated = true;
                        return this.yieldReturn(secondEnumerator.current());
                    }
                    if (firstEnumerator.moveNext()) {
                        count++;
                        return this.yieldReturn(firstEnumerator.current());
                    }
                    if (!isEnumerated && secondEnumerator.moveNext()) {
                        return this.yieldReturn(secondEnumerator.current());
                    }
                    return false;
                },
                function () {
                    try {
                        Utils.dispose(firstEnumerator);
                    }
                    finally {
                        Utils.dispose(secondEnumerator);
                    }
                });
        });
    };

    Enumerable.prototype.alternate = function (alternateValueOrSequence) {
        var source = this;

        return new Enumerable(function () {
            var buffer;
            var enumerator;
            var alternateSequence;
            var alternateEnumerator;

            return new IEnumerator(
                function () {
                    if (alternateValueOrSequence instanceof Array || alternateValueOrSequence.getEnumerator != null) {
                        alternateSequence = Enumerable.from(Enumerable.from(alternateValueOrSequence).toArray()); // freeze
                    }
                    else {
                        alternateSequence = Enumerable.make(alternateValueOrSequence);
                    }
                    enumerator = source.getEnumerator();
                    if (enumerator.moveNext()) buffer = enumerator.current();
                },
                function () {
                    while (true) {
                        if (alternateEnumerator != null) {
                            if (alternateEnumerator.moveNext()) {
                                return this.yieldReturn(alternateEnumerator.current());
                            }
                            else {
                                alternateEnumerator = null;
                            }
                        }

                        if (buffer == null && enumerator.moveNext()) {
                            buffer = enumerator.current(); // hasNext
                            alternateEnumerator = alternateSequence.getEnumerator();
                            continue; // GOTO
                        }
                        else if (buffer != null) {
                            var retVal = buffer;
                            buffer = null;
                            return this.yieldReturn(retVal);
                        }

                        return this.yieldBreak();
                    }
                },
                function () {
                    try {
                        Utils.dispose(enumerator);
                    }
                    finally {
                        Utils.dispose(alternateEnumerator);
                    }
                });
        });
    };

    // Overload:function(value)
    // Overload:function(value, compareSelector)
    Enumerable.prototype.contains = function (value, compareSelector) {
        compareSelector = Utils.createLambda(compareSelector);
        var enumerator = this.getEnumerator();
        try {
            while (enumerator.moveNext()) {
                if (compareSelector(enumerator.current()) === value) return true;
            }
            return false;
        }
        finally {
            Utils.dispose(enumerator);
        }
    };

    Enumerable.prototype.defaultIfEmpty = function (defaultValue) {
        var source = this;
        if (defaultValue === undefined) defaultValue = null;

        return new Enumerable(function () {
            var enumerator;
            var isFirst = true;

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    if (enumerator.moveNext()) {
                        isFirst = false;
                        return this.yieldReturn(enumerator.current());
                    }
                    else if (isFirst) {
                        isFirst = false;
                        return this.yieldReturn(defaultValue);
                    }
                    return false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    // Overload:function()
    // Overload:function(compareSelector)
    Enumerable.prototype.distinct = function (compareSelector) {
        return this.except(Enumerable.empty(), compareSelector);
    };

    Enumerable.prototype.distinctUntilChanged = function (compareSelector) {
        compareSelector = Utils.createLambda(compareSelector);
        var source = this;

        return new Enumerable(function () {
            var enumerator;
            var compareKey;
            var initial;

            return new IEnumerator(
                function () {
                    enumerator = source.getEnumerator();
                },
                function () {
                    while (enumerator.moveNext()) {
                        var key = compareSelector(enumerator.current());

                        if (initial) {
                            initial = false;
                            compareKey = key;
                            return this.yieldReturn(enumerator.current());
                        }

                        if (compareKey === key) {
                            continue;
                        }

                        compareKey = key;
                        return this.yieldReturn(enumerator.current());
                    }
                    return this.yieldBreak();
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    // Overload:function(second)
    // Overload:function(second, compareSelector)
    Enumerable.prototype.except = function (second, compareSelector) {
        compareSelector = Utils.createLambda(compareSelector);
        var source = this;

        return new Enumerable(function () {
            var enumerator;
            var keys;

            return new IEnumerator(
                function () {
                    enumerator = source.getEnumerator();
                    keys = new Dictionary(compareSelector);
                    Enumerable.from(second).forEach(function (key) { keys.add(key); });
                },
                function () {
                    while (enumerator.moveNext()) {
                        var current = enumerator.current();
                        if (!keys.contains(current)) {
                            keys.add(current);
                            return this.yieldReturn(current);
                        }
                    }
                    return false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    // Overload:function(second)
    // Overload:function(second, compareSelector)
    Enumerable.prototype.intersect = function (second, compareSelector) {
        compareSelector = Utils.createLambda(compareSelector);
        var source = this;

        return new Enumerable(function () {
            var enumerator;
            var keys;
            var outs;

            return new IEnumerator(
                function () {
                    enumerator = source.getEnumerator();

                    keys = new Dictionary(compareSelector);
                    Enumerable.from(second).forEach(function (key) { keys.add(key); });
                    outs = new Dictionary(compareSelector);
                },
                function () {
                    while (enumerator.moveNext()) {
                        var current = enumerator.current();
                        if (!outs.contains(current) && keys.contains(current)) {
                            outs.add(current);
                            return this.yieldReturn(current);
                        }
                    }
                    return false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    // Overload:function(second)
    // Overload:function(second, compareSelector)
    Enumerable.prototype.sequenceEqual = function (second, compareSelector) {
        compareSelector = Utils.createLambda(compareSelector);

        var firstEnumerator = this.getEnumerator();
        try {
            var secondEnumerator = Enumerable.from(second).getEnumerator();
            try {
                while (firstEnumerator.moveNext()) {
                    if (!secondEnumerator.moveNext()
                    || compareSelector(firstEnumerator.current()) !== compareSelector(secondEnumerator.current())) {
                        return false;
                    }
                }

                if (secondEnumerator.moveNext()) return false;
                return true;
            }
            finally {
                Utils.dispose(secondEnumerator);
            }
        }
        finally {
            Utils.dispose(firstEnumerator);
        }
    };

    Enumerable.prototype.union = function (second, compareSelector) {
        compareSelector = Utils.createLambda(compareSelector);
        var source = this;

        return new Enumerable(function () {
            var firstEnumerator;
            var secondEnumerator;
            var keys;

            return new IEnumerator(
                function () {
                    firstEnumerator = source.getEnumerator();
                    keys = new Dictionary(compareSelector);
                },
                function () {
                    var current;
                    if (secondEnumerator === undefined) {
                        while (firstEnumerator.moveNext()) {
                            current = firstEnumerator.current();
                            if (!keys.contains(current)) {
                                keys.add(current);
                                return this.yieldReturn(current);
                            }
                        }
                        secondEnumerator = Enumerable.from(second).getEnumerator();
                    }
                    while (secondEnumerator.moveNext()) {
                        current = secondEnumerator.current();
                        if (!keys.contains(current)) {
                            keys.add(current);
                            return this.yieldReturn(current);
                        }
                    }
                    return false;
                },
                function () {
                    try {
                        Utils.dispose(firstEnumerator);
                    }
                    finally {
                        Utils.dispose(secondEnumerator);
                    }
                });
        });
    };

    /* Ordering Methods */

    Enumerable.prototype.orderBy = function (keySelector) {
        return new OrderedEnumerable(this, keySelector, false);
    };

    Enumerable.prototype.orderByDescending = function (keySelector) {
        return new OrderedEnumerable(this, keySelector, true);
    };

    Enumerable.prototype.reverse = function () {
        var source = this;

        return new Enumerable(function () {
            var buffer;
            var index;

            return new IEnumerator(
                function () {
                    buffer = source.toArray();
                    index = buffer.length;
                },
                function () {
                    return (index > 0)
                        ? this.yieldReturn(buffer[--index])
                        : false;
                },
                Functions.Blank);
        });
    };

    Enumerable.prototype.shuffle = function () {
        var source = this;

        return new Enumerable(function () {
            var buffer;

            return new IEnumerator(
                function () { buffer = source.toArray(); },
                function () {
                    if (buffer.length > 0) {
                        var i = Math.floor(Math.random() * buffer.length);
                        return this.yieldReturn(buffer.splice(i, 1)[0]);
                    }
                    return false;
                },
                Functions.Blank);
        });
    };

    Enumerable.prototype.weightedSample = function (weightSelector) {
        weightSelector = Utils.createLambda(weightSelector);
        var source = this;

        return new Enumerable(function () {
            var sortedByBound;
            var totalWeight = 0;

            return new IEnumerator(
                function () {
                    sortedByBound = source
                        .choose(function (x) {
                            var weight = weightSelector(x);
                            if (weight <= 0) return null; // ignore 0

                            totalWeight += weight;
                            return { value: x, bound: totalWeight };
                        })
                        .toArray();
                },
                function () {
                    if (sortedByBound.length > 0) {
                        var draw = Math.floor(Math.random() * totalWeight) + 1;

                        var lower = -1;
                        var upper = sortedByBound.length;
                        while (upper - lower > 1) {
                            var index = Math.floor((lower + upper) / 2);
                            if (sortedByBound[index].bound >= draw) {
                                upper = index;
                            }
                            else {
                                lower = index;
                            }
                        }

                        return this.yieldReturn(sortedByBound[upper].value);
                    }

                    return this.yieldBreak();
                },
                Functions.Blank);
        });
    };

    /* Grouping Methods */

    // Overload:function(keySelector)
    // Overload:function(keySelector,elementSelector)
    // Overload:function(keySelector,elementSelector,resultSelector)
    // Overload:function(keySelector,elementSelector,resultSelector,compareSelector)
    Enumerable.prototype.groupBy = function (keySelector, elementSelector, resultSelector, compareSelector) {
        var source = this;
        keySelector = Utils.createLambda(keySelector);
        elementSelector = Utils.createLambda(elementSelector);
        if (resultSelector != null) resultSelector = Utils.createLambda(resultSelector);
        compareSelector = Utils.createLambda(compareSelector);

        return new Enumerable(function () {
            var enumerator;

            return new IEnumerator(
                function () {
                    enumerator = source.toLookup(keySelector, elementSelector, compareSelector)
                        .toEnumerable()
                        .getEnumerator();
                },
                function () {
                    while (enumerator.moveNext()) {
                        return (resultSelector == null)
                            ? this.yieldReturn(enumerator.current())
                            : this.yieldReturn(resultSelector(enumerator.current().key(), enumerator.current()));
                    }
                    return false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    // Overload:function(keySelector)
    // Overload:function(keySelector,elementSelector)
    // Overload:function(keySelector,elementSelector,resultSelector)
    // Overload:function(keySelector,elementSelector,resultSelector,compareSelector)
    Enumerable.prototype.partitionBy = function (keySelector, elementSelector, resultSelector, compareSelector) {

        var source = this;
        keySelector = Utils.createLambda(keySelector);
        elementSelector = Utils.createLambda(elementSelector);
        compareSelector = Utils.createLambda(compareSelector);
        var hasResultSelector;
        if (resultSelector == null) {
            hasResultSelector = false;
            resultSelector = function (key, group) { return new Grouping(key, group); };
        }
        else {
            hasResultSelector = true;
            resultSelector = Utils.createLambda(resultSelector);
        }

        return new Enumerable(function () {
            var enumerator;
            var key;
            var compareKey;
            var group = [];

            return new IEnumerator(
                function () {
                    enumerator = source.getEnumerator();
                    if (enumerator.moveNext()) {
                        key = keySelector(enumerator.current());
                        compareKey = compareSelector(key);
                        group.push(elementSelector(enumerator.current()));
                    }
                },
                function () {
                    var hasNext;
                    while ((hasNext = enumerator.moveNext()) == true) {
                        if (compareKey === compareSelector(keySelector(enumerator.current()))) {
                            group.push(elementSelector(enumerator.current()));
                        }
                        else break;
                    }

                    if (group.length > 0) {
                        var result = (hasResultSelector)
                            ? resultSelector(key, Enumerable.from(group))
                            : resultSelector(key, group);
                        if (hasNext) {
                            key = keySelector(enumerator.current());
                            compareKey = compareSelector(key);
                            group = [elementSelector(enumerator.current())];
                        }
                        else group = [];

                        return this.yieldReturn(result);
                    }

                    return false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    Enumerable.prototype.buffer = function (count) {
        var source = this;

        return new Enumerable(function () {
            var enumerator;

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    var array = [];
                    var index = 0;
                    while (enumerator.moveNext()) {
                        array.push(enumerator.current());
                        if (++index >= count) return this.yieldReturn(array);
                    }
                    if (array.length > 0) return this.yieldReturn(array);
                    return false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    /* Aggregate Methods */

    // Overload:function(func)
    // Overload:function(seed,func)
    // Overload:function(seed,func,resultSelector)
    Enumerable.prototype.aggregate = function (seed, func, resultSelector) {
        resultSelector = Utils.createLambda(resultSelector);
        return resultSelector(this.scan(seed, func, resultSelector).last());
    };

    // Overload:function()
    // Overload:function(selector)
    Enumerable.prototype.average = function (selector) {
        selector = Utils.createLambda(selector);

        var sum = 0;
        var count = 0;
        this.forEach(function (x) {
            sum += selector(x);
            ++count;
        });

        return sum / count;
    };

    // Overload:function()
    // Overload:function(predicate)
    Enumerable.prototype.count = function (predicate) {
        predicate = (predicate == null) ? Functions.True : Utils.createLambda(predicate);

        var count = 0;
        this.forEach(function (x, i) {
            if (predicate(x, i))++count;
        });
        return count;
    };

    // Overload:function()
    // Overload:function(selector)
    Enumerable.prototype.max = function (selector) {
        if (selector == null) selector = Functions.Identity;
        return this.select(selector).aggregate(function (a, b) { return (a > b) ? a : b; });
    };

    // Overload:function()
    // Overload:function(selector)
    Enumerable.prototype.min = function (selector) {
        if (selector == null) selector = Functions.Identity;
        return this.select(selector).aggregate(function (a, b) { return (a < b) ? a : b; });
    };

    Enumerable.prototype.maxBy = function (keySelector) {
        keySelector = Utils.createLambda(keySelector);
        return this.aggregate(function (a, b) { return (keySelector(a) > keySelector(b)) ? a : b; });
    };

    Enumerable.prototype.minBy = function (keySelector) {
        keySelector = Utils.createLambda(keySelector);
        return this.aggregate(function (a, b) { return (keySelector(a) < keySelector(b)) ? a : b; });
    };

    // Overload:function()
    // Overload:function(selector)
    Enumerable.prototype.sum = function (selector) {
        if (selector == null) selector = Functions.Identity;
        return this.select(selector).aggregate(0, function (a, b) { return a + b; });
    };

    /* Paging Methods */

    Enumerable.prototype.elementAt = function (index) {
        var value;
        var found = false;
        this.forEach(function (x, i) {
            if (i == index) {
                value = x;
                found = true;
                return false;
            }
        });

        if (!found) throw new Error("index is less than 0 or greater than or equal to the number of elements in source.");
        return value;
    };

    Enumerable.prototype.elementAtOrDefault = function (index, defaultValue) {
        if (defaultValue === undefined) defaultValue = null;
        var value;
        var found = false;
        this.forEach(function (x, i) {
            if (i == index) {
                value = x;
                found = true;
                return false;
            }
        });

        return (!found) ? defaultValue : value;
    };

    // Overload:function()
    // Overload:function(predicate)
    Enumerable.prototype.first = function (predicate) {
        if (predicate != null) return this.where(predicate).first();

        var value;
        var found = false;
        this.forEach(function (x) {
            value = x;
            found = true;
            return false;
        });

        if (!found) throw new Error("first:No element satisfies the condition.");
        return value;
    };

    Enumerable.prototype.firstOrDefault = function (predicate, defaultValue) {
        if (defaultValue === undefined) defaultValue = null;
        if (predicate != null) return this.where(predicate).firstOrDefault(null, defaultValue);

        var value;
        var found = false;
        this.forEach(function (x) {
            value = x;
            found = true;
            return false;
        });
        return (!found) ? defaultValue : value;
    };

    // Overload:function()
    // Overload:function(predicate)
    Enumerable.prototype.last = function (predicate) {
        if (predicate != null) return this.where(predicate).last();

        var value;
        var found = false;
        this.forEach(function (x) {
            found = true;
            value = x;
        });

        if (!found) throw new Error("last:No element satisfies the condition.");
        return value;
    };

    // Overload:function(defaultValue)
    // Overload:function(defaultValue,predicate)
    Enumerable.prototype.lastOrDefault = function (predicate, defaultValue) {
        if (defaultValue === undefined) defaultValue = null;
        if (predicate != null) return this.where(predicate).lastOrDefault(null, defaultValue);

        var value;
        var found = false;
        this.forEach(function (x) {
            found = true;
            value = x;
        });
        return (!found) ? defaultValue : value;
    };

    // Overload:function()
    // Overload:function(predicate)
    Enumerable.prototype.single = function (predicate) {
        if (predicate != null) return this.where(predicate).single();

        var value;
        var found = false;
        this.forEach(function (x) {
            if (!found) {
                found = true;
                value = x;
            } else throw new Error("single:sequence contains more than one element.");
        });

        if (!found) throw new Error("single:No element satisfies the condition.");
        return value;
    };

    // Overload:function(defaultValue)
    // Overload:function(defaultValue,predicate)
    Enumerable.prototype.singleOrDefault = function (predicate, defaultValue) {
        if (defaultValue === undefined) defaultValue = null;
        if (predicate != null) return this.where(predicate).singleOrDefault(null, defaultValue);

        var value;
        var found = false;
        this.forEach(function (x) {
            if (!found) {
                found = true;
                value = x;
            } else throw new Error("single:sequence contains more than one element.");
        });

        return (!found) ? defaultValue : value;
    };

    Enumerable.prototype.skip = function (count) {
        var source = this;

        return new Enumerable(function () {
            var enumerator;
            var index = 0;

            return new IEnumerator(
                function () {
                    enumerator = source.getEnumerator();
                    while (index++ < count && enumerator.moveNext()) {
                    }
                    ;
                },
                function () {
                    return (enumerator.moveNext())
                        ? this.yieldReturn(enumerator.current())
                        : false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    // Overload:function(predicate<element>)
    // Overload:function(predicate<element,index>)
    Enumerable.prototype.skipWhile = function (predicate) {
        predicate = Utils.createLambda(predicate);
        var source = this;

        return new Enumerable(function () {
            var enumerator;
            var index = 0;
            var isSkipEnd = false;

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    while (!isSkipEnd) {
                        if (enumerator.moveNext()) {
                            if (!predicate(enumerator.current(), index++)) {
                                isSkipEnd = true;
                                return this.yieldReturn(enumerator.current());
                            }
                            continue;
                        } else return false;
                    }

                    return (enumerator.moveNext())
                        ? this.yieldReturn(enumerator.current())
                        : false;

                },
                function () { Utils.dispose(enumerator); });
        });
    };

    Enumerable.prototype.take = function (count) {
        var source = this;

        return new Enumerable(function () {
            var enumerator;
            var index = 0;

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    return (index++ < count && enumerator.moveNext())
                        ? this.yieldReturn(enumerator.current())
                        : false;
                },
                function () { Utils.dispose(enumerator); }
            );
        });
    };

    // Overload:function(predicate<element>)
    // Overload:function(predicate<element,index>)
    Enumerable.prototype.takeWhile = function (predicate) {
        predicate = Utils.createLambda(predicate);
        var source = this;

        return new Enumerable(function () {
            var enumerator;
            var index = 0;

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    return (enumerator.moveNext() && predicate(enumerator.current(), index++))
                        ? this.yieldReturn(enumerator.current())
                        : false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    // Overload:function()
    // Overload:function(count)
    Enumerable.prototype.takeExceptLast = function (count) {
        if (count == null) count = 1;
        var source = this;

        return new Enumerable(function () {
            if (count <= 0) return source.getEnumerator(); // do nothing

            var enumerator;
            var q = [];

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    while (enumerator.moveNext()) {
                        if (q.length == count) {
                            q.push(enumerator.current());
                            return this.yieldReturn(q.shift());
                        }
                        q.push(enumerator.current());
                    }
                    return false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    Enumerable.prototype.takeFromLast = function (count) {
        if (count <= 0 || count == null) return Enumerable.empty();
        var source = this;

        return new Enumerable(function () {
            var sourceEnumerator;
            var enumerator;
            var q = [];

            return new IEnumerator(
                function () { sourceEnumerator = source.getEnumerator(); },
                function () {
                    while (sourceEnumerator.moveNext()) {
                        if (q.length == count) q.shift();
                        q.push(sourceEnumerator.current());
                    }
                    if (enumerator == null) {
                        enumerator = Enumerable.from(q).getEnumerator();
                    }
                    return (enumerator.moveNext())
                        ? this.yieldReturn(enumerator.current())
                        : false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    // Overload:function(item)
    // Overload:function(predicate)
    Enumerable.prototype.indexOf = function (item) {
        var found = null;

        // item as predicate
        if (typeof (item) === Types.Function) {
            this.forEach(function (x, i) {
                if (item(x, i)) {
                    found = i;
                    return false;
                }
            });
        }
        else {
            this.forEach(function (x, i) {
                if (x === item) {
                    found = i;
                    return false;
                }
            });
        }

        return (found !== null) ? found : -1;
    };

    // Overload:function(item)
    // Overload:function(predicate)
    Enumerable.prototype.lastIndexOf = function (item) {
        var result = -1;

        // item as predicate
        if (typeof (item) === Types.Function) {
            this.forEach(function (x, i) {
                if (item(x, i)) result = i;
            });
        }
        else {
            this.forEach(function (x, i) {
                if (x === item) result = i;
            });
        }

        return result;
    };

    /* Convert Methods */

    Enumerable.prototype.asEnumerable = function () {
        return Enumerable.from(this);
    };

    Enumerable.prototype.toArray = function () {
        var array = [];
        this.forEach(function (x) { array.push(x); });
        return array;
    };

    // Overload:function(keySelector)
    // Overload:function(keySelector, elementSelector)
    // Overload:function(keySelector, elementSelector, compareSelector)
    Enumerable.prototype.toLookup = function (keySelector, elementSelector, compareSelector) {
        keySelector = Utils.createLambda(keySelector);
        elementSelector = Utils.createLambda(elementSelector);
        compareSelector = Utils.createLambda(compareSelector);

        var dict = new Dictionary(compareSelector);
        this.forEach(function (x) {
            var key = keySelector(x);
            var element = elementSelector(x);

            var array = dict.get(key);
            if (array !== undefined) array.push(element);
            else dict.add(key, [element]);
        });
        return new Lookup(dict);
    };

    Enumerable.prototype.toObject = function (keySelector, elementSelector) {
        keySelector = Utils.createLambda(keySelector);
        elementSelector = Utils.createLambda(elementSelector);

        var obj = {};
        this.forEach(function (x) {
            obj[keySelector(x)] = elementSelector(x);
        });
        return obj;
    };

    // Overload:function(keySelector, elementSelector)
    // Overload:function(keySelector, elementSelector, compareSelector)
    Enumerable.prototype.toDictionary = function (keySelector, elementSelector, compareSelector) {
        keySelector = Utils.createLambda(keySelector);
        elementSelector = Utils.createLambda(elementSelector);
        compareSelector = Utils.createLambda(compareSelector);

        var dict = new Dictionary(compareSelector);
        this.forEach(function (x) {
            dict.add(keySelector(x), elementSelector(x));
        });
        return dict;
    };

    // Overload:function()
    // Overload:function(replacer)
    // Overload:function(replacer, space)
    Enumerable.prototype.toJSONString = function (replacer, space) {
        if (typeof JSON === Types.Undefined || JSON.stringify == null) {
            throw new Error("toJSONString can't find JSON.stringify. This works native JSON support Browser or include json2.js");
        }
        return JSON.stringify(this.toArray(), replacer, space);
    };

    // Overload:function()
    // Overload:function(separator)
    // Overload:function(separator,selector)
    Enumerable.prototype.toJoinedString = function (separator, selector) {
        if (separator == null) separator = "";
        if (selector == null) selector = Functions.Identity;

        return this.select(selector).toArray().join(separator);
    };


    /* Action Methods */

    // Overload:function(action<element>)
    // Overload:function(action<element,index>)
    Enumerable.prototype.doAction = function (action) {
        var source = this;
        action = Utils.createLambda(action);

        return new Enumerable(function () {
            var enumerator;
            var index = 0;

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    if (enumerator.moveNext()) {
                        action(enumerator.current(), index++);
                        return this.yieldReturn(enumerator.current());
                    }
                    return false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    // Overload:function(action<element>)
    // Overload:function(action<element,index>)
    // Overload:function(func<element,bool>)
    // Overload:function(func<element,index,bool>)
    Enumerable.prototype.forEach = function (action) {
        action = Utils.createLambda(action);

        var index = 0;
        var enumerator = this.getEnumerator();
        try {
            while (enumerator.moveNext()) {
                if (action(enumerator.current(), index++) === false) break;
            }
        } finally {
            Utils.dispose(enumerator);
        }
    };

    // Overload:function()
    // Overload:function(separator)
    // Overload:function(separator,selector)
    Enumerable.prototype.write = function (separator, selector) {
        if (separator == null) separator = "";
        selector = Utils.createLambda(selector);

        var isFirst = true;
        this.forEach(function (item) {
            if (isFirst) isFirst = false;
            else document.write(separator);
            document.write(selector(item));
        });
    };

    // Overload:function()
    // Overload:function(selector)
    Enumerable.prototype.writeLine = function (selector) {
        selector = Utils.createLambda(selector);

        this.forEach(function (item) {
            document.writeln(selector(item) + "<br />");
        });
    };

    Enumerable.prototype.force = function () {
        var enumerator = this.getEnumerator();

        try {
            while (enumerator.moveNext()) {
            }
        }
        finally {
            Utils.dispose(enumerator);
        }
    };

    /* Functional Methods */

    Enumerable.prototype.letBind = function (func) {
        func = Utils.createLambda(func);
        var source = this;

        return new Enumerable(function () {
            var enumerator;

            return new IEnumerator(
                function () {
                    enumerator = Enumerable.from(func(source)).getEnumerator();
                },
                function () {
                    return (enumerator.moveNext())
                        ? this.yieldReturn(enumerator.current())
                        : false;
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    Enumerable.prototype.share = function () {
        var source = this;
        var sharedEnumerator;
        var disposed = false;

        return new DisposableEnumerable(function () {
            return new IEnumerator(
                function () {
                    if (sharedEnumerator == null) {
                        sharedEnumerator = source.getEnumerator();
                    }
                },
                function () {
                    if (disposed) throw new Error("enumerator is disposed");

                    return (sharedEnumerator.moveNext())
                        ? this.yieldReturn(sharedEnumerator.current())
                        : false;
                },
                Functions.Blank
            );
        }, function () {
            disposed = true;
            Utils.dispose(sharedEnumerator);
        });
    };

    Enumerable.prototype.memoize = function () {
        var source = this;
        var cache;
        var enumerator;
        var disposed = false;

        return new DisposableEnumerable(function () {
            var index = -1;

            return new IEnumerator(
                function () {
                    if (enumerator == null) {
                        enumerator = source.getEnumerator();
                        cache = [];
                    }
                },
                function () {
                    if (disposed) throw new Error("enumerator is disposed");

                    index++;
                    if (cache.length <= index) {
                        return (enumerator.moveNext())
                            ? this.yieldReturn(cache[index] = enumerator.current())
                            : false;
                    }

                    return this.yieldReturn(cache[index]);
                },
                Functions.Blank
            );
        }, function () {
            disposed = true;
            Utils.dispose(enumerator);
            cache = null;
        });
    };

    /* Error Handling Methods */

    Enumerable.prototype.catchError = function (handler) {
        handler = Utils.createLambda(handler);
        var source = this;

        return new Enumerable(function () {
            var enumerator;

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    try {
                        return (enumerator.moveNext())
                            ? this.yieldReturn(enumerator.current())
                            : false;
                    } catch (e) {
                        handler(e);
                        return false;
                    }
                },
                function () { Utils.dispose(enumerator); });
        });
    };

    Enumerable.prototype.finallyAction = function (finallyAction) {
        finallyAction = Utils.createLambda(finallyAction);
        var source = this;

        return new Enumerable(function () {
            var enumerator;

            return new IEnumerator(
                function () { enumerator = source.getEnumerator(); },
                function () {
                    return (enumerator.moveNext())
                        ? this.yieldReturn(enumerator.current())
                        : false;
                },
                function () {
                    try {
                        Utils.dispose(enumerator);
                    } finally {
                        finallyAction();
                    }
                });
        });
    };

    /* For Debug Methods */

    // Overload:function()
    // Overload:function(selector)
    Enumerable.prototype.log = function (selector) {
        selector = Utils.createLambda(selector);

        return this.doAction(function (item) {
            if (typeof console !== Types.Undefined) {
                console.log(selector(item));
            }
        });
    };

    // Overload:function()
    // Overload:function(message)
    // Overload:function(message,selector)
    Enumerable.prototype.trace = function (message, selector) {
        if (message == null) message = "Trace";
        selector = Utils.createLambda(selector);

        return this.doAction(function (item) {
            if (typeof console !== Types.Undefined) {
                console.log(message, selector(item));
            }
        });
    };

    // private

    var OrderedEnumerable = function (source, keySelector, descending, parent) {
        this.source = source;
        this.keySelector = Utils.createLambda(keySelector);
        this.descending = descending;
        this.parent = parent;
    };
    OrderedEnumerable.prototype = new Enumerable();

    OrderedEnumerable.prototype.createOrderedEnumerable = function (keySelector, descending) {
        return new OrderedEnumerable(this.source, keySelector, descending, this);
    };
    OrderedEnumerable.prototype.thenBy = function (keySelector) {
        return this.createOrderedEnumerable(keySelector, false);
    };
    OrderedEnumerable.prototype.thenByDescending = function (keySelector) {
        return this.createOrderedEnumerable(keySelector, true);
    };
    OrderedEnumerable.prototype.getEnumerator = function () {
        var self = this;
        var buffer;
        var indexes;
        var index = 0;

        return new IEnumerator(
            function () {
                buffer = [];
                indexes = [];
                self.source.forEach(function (item, index) {
                    buffer.push(item);
                    indexes.push(index);
                });
                var sortContext = SortContext.create(self, null);
                sortContext.GenerateKeys(buffer);

                indexes.sort(function (a, b) { return sortContext.compare(a, b); });
            },
            function () {
                return (index < indexes.length)
                    ? this.yieldReturn(buffer[indexes[index++]])
                    : false;
            },
            Functions.Blank
        );
    };

    var SortContext = function (keySelector, descending, child) {
        this.keySelector = keySelector;
        this.descending = descending;
        this.child = child;
        this.keys = null;
    };
    SortContext.create = function (orderedEnumerable, currentContext) {
        var context = new SortContext(orderedEnumerable.keySelector, orderedEnumerable.descending, currentContext);
        if (orderedEnumerable.parent != null) return SortContext.create(orderedEnumerable.parent, context);
        return context;
    };
    SortContext.prototype.GenerateKeys = function (source) {
        var len = source.length;
        var keySelector = this.keySelector;
        var keys = new Array(len);
        for (var i = 0; i < len; i++) keys[i] = keySelector(source[i]);
        this.keys = keys;

        if (this.child != null) this.child.GenerateKeys(source);
    };
    SortContext.prototype.compare = function (index1, index2) {
        var comparison = Utils.compare(this.keys[index1], this.keys[index2]);

        if (comparison == 0) {
            if (this.child != null) return this.child.compare(index1, index2);
            return Utils.compare(index1, index2);
        }

        return (this.descending) ? -comparison : comparison;
    };

    var DisposableEnumerable = function (getEnumerator, dispose) {
        this.dispose = dispose;
        Enumerable.call(this, getEnumerator);
    };
    DisposableEnumerable.prototype = new Enumerable();

    // optimize array or arraylike object

    var ArrayEnumerable = function (source) {
        this.getSource = function () { return source; };
    };
    ArrayEnumerable.prototype = new Enumerable();

    ArrayEnumerable.prototype.any = function (predicate) {
        return (predicate == null)
            ? (this.getSource().length > 0)
            : Enumerable.prototype.any.apply(this, arguments);
    };

    ArrayEnumerable.prototype.count = function (predicate) {
        return (predicate == null)
            ? this.getSource().length
            : Enumerable.prototype.count.apply(this, arguments);
    };

    ArrayEnumerable.prototype.elementAt = function (index) {
        var source = this.getSource();
        return (0 <= index && index < source.length)
            ? source[index]
            : Enumerable.prototype.elementAt.apply(this, arguments);
    };

    ArrayEnumerable.prototype.elementAtOrDefault = function (index, defaultValue) {
        if (defaultValue === undefined) defaultValue = null;
        var source = this.getSource();
        return (0 <= index && index < source.length)
            ? source[index]
            : defaultValue;
    };

    ArrayEnumerable.prototype.first = function (predicate) {
        var source = this.getSource();
        return (predicate == null && source.length > 0)
            ? source[0]
            : Enumerable.prototype.first.apply(this, arguments);
    };

    ArrayEnumerable.prototype.firstOrDefault = function (predicate, defaultValue) {
        if (defaultValue === undefined) defaultValue = null;
        if (predicate != null) {
            return Enumerable.prototype.firstOrDefault.apply(this, arguments);
        }

        var source = this.getSource();
        return source.length > 0 ? source[0] : defaultValue;
    };

    ArrayEnumerable.prototype.last = function (predicate) {
        var source = this.getSource();
        return (predicate == null && source.length > 0)
            ? source[source.length - 1]
            : Enumerable.prototype.last.apply(this, arguments);
    };

    ArrayEnumerable.prototype.lastOrDefault = function (predicate, defaultValue) {
        if (defaultValue === undefined) defaultValue = null;
        if (predicate != null) {
            return Enumerable.prototype.lastOrDefault.apply(this, arguments);
        }

        var source = this.getSource();
        return source.length > 0 ? source[source.length - 1] : defaultValue;
    };

    ArrayEnumerable.prototype.skip = function (count) {
        var source = this.getSource();

        return new Enumerable(function () {
            var index;

            return new IEnumerator(
                function () { index = (count < 0) ? 0 : count; },
                function () {
                    return (index < source.length)
                        ? this.yieldReturn(source[index++])
                        : false;
                },
                Functions.Blank);
        });
    };

    ArrayEnumerable.prototype.takeExceptLast = function (count) {
        if (count == null) count = 1;
        return this.take(this.getSource().length - count);
    };

    ArrayEnumerable.prototype.takeFromLast = function (count) {
        return this.skip(this.getSource().length - count);
    };

    ArrayEnumerable.prototype.reverse = function () {
        var source = this.getSource();

        return new Enumerable(function () {
            var index;

            return new IEnumerator(
                function () {
                    index = source.length;
                },
                function () {
                    return (index > 0)
                        ? this.yieldReturn(source[--index])
                        : false;
                },
                Functions.Blank);
        });
    };

    ArrayEnumerable.prototype.sequenceEqual = function (second, compareSelector) {
        if ((second instanceof ArrayEnumerable || second instanceof Array)
            && compareSelector == null
            && Enumerable.from(second).count() != this.count()) {
            return false;
        }

        return Enumerable.prototype.sequenceEqual.apply(this, arguments);
    };

    ArrayEnumerable.prototype.toJoinedString = function (separator, selector) {
        var source = this.getSource();
        if (selector != null || !(source instanceof Array)) {
            return Enumerable.prototype.toJoinedString.apply(this, arguments);
        }

        if (separator == null) separator = "";
        return source.join(separator);
    };

    ArrayEnumerable.prototype.getEnumerator = function () {
        var source = this.getSource();
        var index = -1;

        // fast and simple enumerator
        return {
            current: function () { return source[index]; },
            moveNext: function () {
                return ++index < source.length;
            },
            dispose: Functions.Blank
        };
    };

    // optimization for multiple where and multiple select and whereselect

    var WhereEnumerable = function (source, predicate) {
        this.prevSource = source;
        this.prevPredicate = predicate; // predicate.length always <= 1
    };
    WhereEnumerable.prototype = new Enumerable();

    WhereEnumerable.prototype.where = function (predicate) {
        predicate = Utils.createLambda(predicate);

        if (predicate.length <= 1) {
            var prevPredicate = this.prevPredicate;
            var composedPredicate = function (x) { return prevPredicate(x) && predicate(x); };
            return new WhereEnumerable(this.prevSource, composedPredicate);
        }
        else {
            // if predicate use index, can't compose
            return Enumerable.prototype.where.call(this, predicate);
        }
    };

    WhereEnumerable.prototype.select = function (selector) {
        selector = Utils.createLambda(selector);

        return (selector.length <= 1)
            ? new WhereSelectEnumerable(this.prevSource, this.prevPredicate, selector)
            : Enumerable.prototype.select.call(this, selector);
    };

    WhereEnumerable.prototype.getEnumerator = function () {
        var predicate = this.prevPredicate;
        var source = this.prevSource;
        var enumerator;

        return new IEnumerator(
            function () { enumerator = source.getEnumerator(); },
            function () {
                while (enumerator.moveNext()) {
                    if (predicate(enumerator.current())) {
                        return this.yieldReturn(enumerator.current());
                    }
                }
                return false;
            },
            function () { Utils.dispose(enumerator); });
    };

    var WhereSelectEnumerable = function (source, predicate, selector) {
        this.prevSource = source;
        this.prevPredicate = predicate; // predicate.length always <= 1 or null
        this.prevSelector = selector; // selector.length always <= 1
    };
    WhereSelectEnumerable.prototype = new Enumerable();

    WhereSelectEnumerable.prototype.where = function (predicate) {
        predicate = Utils.createLambda(predicate);

        return (predicate.length <= 1)
            ? new WhereEnumerable(this, predicate)
            : Enumerable.prototype.where.call(this, predicate);
    };

    WhereSelectEnumerable.prototype.select = function (selector) {
        selector = Utils.createLambda(selector);

        if (selector.length <= 1) {
            var prevSelector = this.prevSelector;
            var composedSelector = function (x) { return selector(prevSelector(x)); };
            return new WhereSelectEnumerable(this.prevSource, this.prevPredicate, composedSelector);
        }
        else {
            // if selector use index, can't compose
            return Enumerable.prototype.select.call(this, selector);
        }
    };

    WhereSelectEnumerable.prototype.getEnumerator = function () {
        var predicate = this.prevPredicate;
        var selector = this.prevSelector;
        var source = this.prevSource;
        var enumerator;

        return new IEnumerator(
            function () { enumerator = source.getEnumerator(); },
            function () {
                while (enumerator.moveNext()) {
                    if (predicate == null || predicate(enumerator.current())) {
                        return this.yieldReturn(selector(enumerator.current()));
                    }
                }
                return false;
            },
            function () { Utils.dispose(enumerator); });
    };

    // Collections

    var Dictionary = (function () {
        // static utility methods
        var callHasOwnProperty = function (target, key) {
            return Object.prototype.hasOwnProperty.call(target, key);
        };

        var computeHashCode = function (obj) {
            if (obj === null) return "null";
            if (obj === undefined) return "undefined";

            return (typeof obj.toString === Types.Function)
                ? obj.toString()
                : Object.prototype.toString.call(obj);
        };

        // LinkedList for Dictionary
        var HashEntry = function (key, value) {
            this.key = key;
            this.value = value;
            this.prev = null;
            this.next = null;
        };

        var EntryList = function () {
            this.first = null;
            this.last = null;
        };
        EntryList.prototype =
        {
            addLast: function (entry) {
                if (this.last != null) {
                    this.last.next = entry;
                    entry.prev = this.last;
                    this.last = entry;
                } else this.first = this.last = entry;
            },

            replace: function (entry, newEntry) {
                if (entry.prev != null) {
                    entry.prev.next = newEntry;
                    newEntry.prev = entry.prev;
                } else this.first = newEntry;

                if (entry.next != null) {
                    entry.next.prev = newEntry;
                    newEntry.next = entry.next;
                } else this.last = newEntry;

            },

            remove: function (entry) {
                if (entry.prev != null) entry.prev.next = entry.next;
                else this.first = entry.next;

                if (entry.next != null) entry.next.prev = entry.prev;
                else this.last = entry.prev;
            }
        };

        // Overload:function()
        // Overload:function(compareSelector)
        var Dictionary = function (compareSelector) {
            this.countField = 0;
            this.entryList = new EntryList();
            this.buckets = {}; // as Dictionary<string,List<object>>
            this.compareSelector = (compareSelector == null) ? Functions.Identity : compareSelector;
        };
        Dictionary.prototype =
        {
            add: function (key, value) {
                var compareKey = this.compareSelector(key);
                var hash = computeHashCode(compareKey);
                var entry = new HashEntry(key, value);
                if (callHasOwnProperty(this.buckets, hash)) {
                    var array = this.buckets[hash];
                    for (var i = 0; i < array.length; i++) {
                        if (this.compareSelector(array[i].key) === compareKey) {
                            this.entryList.replace(array[i], entry);
                            array[i] = entry;
                            return;
                        }
                    }
                    array.push(entry);
                } else {
                    this.buckets[hash] = [entry];
                }
                this.countField++;
                this.entryList.addLast(entry);
            },

            get: function (key) {
                var compareKey = this.compareSelector(key);
                var hash = computeHashCode(compareKey);
                if (!callHasOwnProperty(this.buckets, hash)) return undefined;

                var array = this.buckets[hash];
                for (var i = 0; i < array.length; i++) {
                    var entry = array[i];
                    if (this.compareSelector(entry.key) === compareKey) return entry.value;
                }
                return undefined;
            },

            set: function (key, value) {
                var compareKey = this.compareSelector(key);
                var hash = computeHashCode(compareKey);
                if (callHasOwnProperty(this.buckets, hash)) {
                    var array = this.buckets[hash];
                    for (var i = 0; i < array.length; i++) {
                        if (this.compareSelector(array[i].key) === compareKey) {
                            var newEntry = new HashEntry(key, value);
                            this.entryList.replace(array[i], newEntry);
                            array[i] = newEntry;
                            return true;
                        }
                    }
                }
                return false;
            },

            contains: function (key) {
                var compareKey = this.compareSelector(key);
                var hash = computeHashCode(compareKey);
                if (!callHasOwnProperty(this.buckets, hash)) return false;

                var array = this.buckets[hash];
                for (var i = 0; i < array.length; i++) {
                    if (this.compareSelector(array[i].key) === compareKey) return true;
                }
                return false;
            },

            clear: function () {
                this.countField = 0;
                this.buckets = {};
                this.entryList = new EntryList();
            },

            remove: function (key) {
                var compareKey = this.compareSelector(key);
                var hash = computeHashCode(compareKey);
                if (!callHasOwnProperty(this.buckets, hash)) return;

                var array = this.buckets[hash];
                for (var i = 0; i < array.length; i++) {
                    if (this.compareSelector(array[i].key) === compareKey) {
                        this.entryList.remove(array[i]);
                        array.splice(i, 1);
                        if (array.length == 0) delete this.buckets[hash];
                        this.countField--;
                        return;
                    }
                }
            },

            count: function () {
                return this.countField;
            },

            toEnumerable: function () {
                var self = this;
                return new Enumerable(function () {
                    var currentEntry;

                    return new IEnumerator(
                        function () { currentEntry = self.entryList.first; },
                        function () {
                            if (currentEntry != null) {
                                var result = { key: currentEntry.key, value: currentEntry.value };
                                currentEntry = currentEntry.next;
                                return this.yieldReturn(result);
                            }
                            return false;
                        },
                        Functions.Blank);
                });
            }
        };

        return Dictionary;
    })();

    // dictionary = Dictionary<TKey, TValue[]>
    var Lookup = function (dictionary) {
        this.count = function () {
            return dictionary.count();
        };
        this.get = function (key) {
            return Enumerable.from(dictionary.get(key));
        };
        this.contains = function (key) {
            return dictionary.contains(key);
        };
        this.toEnumerable = function () {
            return dictionary.toEnumerable().select(function (kvp) {
                return new Grouping(kvp.key, kvp.value);
            });
        };
    };

    var Grouping = function (groupKey, elements) {
        this.key = function () {
            return groupKey;
        };
        ArrayEnumerable.call(this, elements);
    };
    Grouping.prototype = new ArrayEnumerable();

    // module export
    if (typeof define === Types.Function && define.amd) { // AMD
        define("linqjs", [], function () { return Enumerable; });
    }
    else if (typeof module !== Types.Undefined && module.exports) { // Node
        module.exports = Enumerable;
    }
    else {
        root.Enumerable = Enumerable;
    }
})(this);/*
 * slighty modified version of ltxml, see orginal license below.
 * TODO, port all this code to TypeScript.
 */

/*
The MIT License (MIT)
Copyright (c) 2012 Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files
(the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR 
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/***************************************************************************

Copyright (c) Microsoft Corporation 2013.

This code is licensed using the Microsoft Public License (Ms-PL).  You can find the text of the license here:

http://www.microsoft.com/resources/sharedsource/licensingbasics/publiclicense.mspx

Published at http://OpenXmlDeveloper.org
Resource Center and Documentation: http://openxmldeveloper.org/wiki/w/wiki/open-xml-sdk-for-javascript.aspx

Developer: Eric White
Blog: http://www.ericwhite.com
Twitter: @EricWhiteDev
Email: eric@ericwhite.com

***************************************************************************/

/*********************** API ***********************/
/*

***** Ltxml *****
* Ltxml.clearCache()

****************************************************
*===== XName =====
* new XName(namespace, name)      // namespace is an XNamespace object, name is string
* new XName(name)                 // name is string, is in no namespace
* new XName(name)                 // name = '{namespaceURI}name'
* XName.get(expandedName)
* XName.get(namespace, localName)
* XName.toString()

***** props implemented as fields *****
* XName.localName
* XName.namespace
* XName.namespaceName

****************************************************
*===== XNamespace =====
* new XNamespace(uri)
* XNamespace.get(uri)
* XNamespace.getName(localName)
* XNamespace.toString()

***** props implemented as fields *****
* XNamespace.namespaceName

***** static props *****
* XNamespace.getNone()               // returns namespace for 'no namespace'
* XNamespace.none

* XNamespace.getXml()                // http://www.w3.org/XML/1998/namespace
* XNamespace.xml

* XNamespace.getXmlns()              // http://www.w3.org/2000/xmlns/
* XNamespace.xmlns

****************************************************
*===== XObject (abstract) =====
* XObject.addAnnotation(type, object)  // type is string
* XObject.annotation(type)
* XObject.annotations(type)
* XObject.removeAnnotations
* XObject.removeAnnotations(type)

***** props implemented as fields *****
* XObject.nodeType
* XObject.parent

***** props *****
* XObject.getDocument()
* XObject.document

****************************************************
*===== XNode: XObject (abstract) =====
* XNode.addAfterSelf(varargs)
* XNode.addBeforeSelf(varargs)
* XNode.ancestors()
* XNode.ancestors(xname)
* XNode.deepEquals
* XNode.elementsAfterSelf()
* XNode.elementsAfterSelf(xname)
* XNode.elementsBeforeSelf()
* XNode.elementsBeforeSelf(xname)
* XNode.nodesAfterSelf()
* XNode.nodesBeforeSelf()
* XNode.remove()
* XNode.replaceWith(content)

***** props implemented as field *****
* XNode.nodeType
* XNode.parent

***** props *****
* XNode.getNextNode()
* XNode.nextNode

* XNode.getPreviousNode()
* XNode.previousNode

****************************************************
*===== XAttribute: XObject =====
* new XAttribute(name, value)
* new XAttribute(XAttribute)
* XAttribute.remove()
* XAttribute.setValue(value)
* XAttribute.toString()

***** props implemented as fields *****
* XAttribute.isNamespaceDeclaration
* XAttribute.name
* XAttribute.nodeType
* XAttribute.parent
* XAttribute.value

***** props *****
* XAttribute.getNextAttribute()
* XAttribute.nextAttribute

* XAttribute.getPreviousAttribute()
* XAttribute.previousAttribute

****************************************************
*===== XComment: XNode =====
* new XComment(value)
* new XComment(xcomment)
* XComment.toString()
* XComment.toString(indent)

***** props implemented as fields *****
* XComment.nodeType
* XComment.parent
* XComment.value

****************************************************
*===== XContainer: XNode =====
* XContainer.add(content)
* XContainer.addFirst(content)
* XContainer.descendantNodes
* XContainer.descendants()
* XContainer.descendants(xname)
* XContainer.element(xname)
* XContainer.elements()
* XContainer.elements(xname)
* XContainer.nodes()
* XContainer.removeNodes()
* XContainer.replaceNodes(content)

***** props implemented as fields *****
* XContainer.nodeType
* XContainer.parent

***** props *****
* XContainer.getFirstNode()
* XContainer.firstNode

* XContainer.getLastNode()
* XContainer.lastNode

****************************************************
*===== XDeclaration =====
* new XDeclaration(version, encoding, standalone)
* new XDeclaration(xdeclaration)
* XDeclaration.toString(indent)

***** props implemented as fields *****
* XDeclaration.encoding
* XDeclaration.standalone
* XDeclaration.version

****************************************************
*===== XDocument: XContainer =====
* new XDocument()
* new XDocument(content)
* new XDocument(xdocument)
* new XDocument(xdeclaration, content)
* XDocument.descendants()
* XDocument.descendants(xname)
* XDocument.parse(xml)
* XDocument.load(XMLDocument)
* XDocument.toString()
* XDocument.toString(indent)

***** props implemented as fields *****
* XDocument.nodeType
* XDocument.parent
* XDocument.declaration

***** props *****
* XDocument.getRoot()
* XDocument.root

****************************************************
*===== XElement: XContainer =====
* new XElement(xelement)          copy constructor
* new XElement(xname)
* new XElement(xname, varargs)
* XElement.ancestorsAndSelf()
* XElement.ancestorsAndSelf(xname)
* XElement.attribute(xname)
* XElement.attributes()
* XElement.attributes(xname)
* XElement.descendantNodesAndSelf()
* XElement.descendantsAndSelf()
* XElement.descendantsAndSelf(xname)
* XElement.getDefaultNamespace()
* XElement.getNamespaceOfPrefix()
* XElement.getPrefixOfNamespace()
* XElement.load(XMLDocument)
* XElement.parse()
* XElement.removeAll()
* XElement.removeAttributes()
* XElement.replaceAll(content)
* XElement.replaceAttributes(content)
* XElement.setAttributeValue(xname, value)
* XElement.setElementValue(xname, value)
* XElement.toString()
* XElement.toString(indent)

***** props implemented as fields *****
* XElement.name
* XElement.nodeType
* XElement.parent

***** props *****
* XElement.getFirstAttribute()
* XElement.firstAttribute

* XElement.getHasAttributes()
* XElement.hasAttributes

* XElement.getHasElements()
* XElement.hasElements

* XElement.getIsEmpty()
* XElement.isEmpty

* XElement.getLastAttribute()
* XElement.lastAttribute

* XElement.getValue
* XElement.setValue()
* XElement.value

****************************************************
*===== XProcessingInstruction: XNode =====
* new XProcessingInstruction(xprocessingInstruction)
* new XProcessingInstruction(target, data)
* XProcessingInstruction.toString()
* XProcessingInstruction.toString(indent)

***** props implemented as fields *****
* XProcessingInstruction.data
* XProcessingInstruction.nodeType
* XProcessingInstruction.parent
* XProcessingInstruction.target

****************************************************
*===== XText: XNode =====
* new XText(value)
* new XText(XText)
* XText.toString()

***** props implemented as fields *****
* XText.nodeType
* XText.parent
* XText.value

****************************************************
*===== XEntity: XNode =====
* new XEntity(value)
* new XEntity(XEntity)
* XEntity.toString()

***** props implemented as fields *****
* XEntity.nodeType
* XEntity.parent
* XEntity.value

****************************************************
*===== XCData: XText =====
* new XCData(value)
* new XCData(XCData)
* XCData.toString()

***** props implemented as fields *****
* XCData.nodeType
* XCData.parent
* XCData.value

****************************************************
*===== Extension methods =====
* ancestors()
* ancestors(xname)
* ancestorsAndSelf()
* ancestorsAndSelf(xname)
* attributes()
* attributes(xname)
* descendantNodes()
* descendantNodesAndSelf()
* descendants()
* descendants(xname)
* descendantsAndSelf()
* descendantsAndSelf(xname)
* elements()
* elements(xname)
* nodes()
* remove(xname)

*/

(function (root) {
    "use strict";

    var Ltxml;

    // Ltxml encapsulation function
    function defineLtxml(root, Enumerable) {  //ignore jslints

        var /*parseXml,*/ Functions, Ltxml, addContentThatCanContainEntities,
            serializeAttributeContent, annotateRootForNamespaces,
            prefixCounter, entityCodePoints, entities,
            ancestors, ancestorsAndSelf, attributes, descendantNodes, descendantNodesAndSelf, descendants, descendantsAndSelf, elements,
            inDocumentOrder, nodes, remove
        ;


        var autoGeneratePrefixes = false;

        /********************** utility **********************/

        // if using JQuery
        //Enumerable = $.Enumerable;

        if (!Array.isArray) {
            Array.isArray = function (arg) {
                return Object.prototype.toString.call(arg) == '[object Array]'; //ignore jslint
            };
        }

        Functions = {
            Identity: function (x) { return x; },
            True: function () { return true; },
            Blank: function () { }
        };

        if (!Array.prototype.indexOf) {
            Array.prototype.indexOf = function (item) {
                var i;

                for (i = 0; i < this.length; i += 1) {
                    if (this[i] === item) {
                        return i;
                    }
                }
                return -1;
            };
        }

        /********************** global **********************/

        Ltxml = {};  // container(namespace)

        Ltxml.namespaceCache = {};
        Ltxml.nameCache = {};
        Ltxml.spaces = ' ';
        function getStringBuilder() {
            var data, counter;

            data = [];
            counter = 0;
            return {
                a: function (s) { data[counter += 1] = s; return this; },  //ignore jslint
                toString: function (s) { return data.join(s || ""); }
            };
        }

        Ltxml.clearCache = function () {
            this.namespaceCache = {};
            this.nameCache = {};
        };

        Ltxml.cast = function (elementOrAttribute) {
            if (!elementOrAttribute) {
                return null;
            }
            return elementOrAttribute.value;
        };

        Ltxml.castInt = function (elementOrAttribute) {
            if (!elementOrAttribute) {
                return null;
            }
            return parseInt(elementOrAttribute.value, 10);
        };

        function addContent(xobj, putContentFunc, putAttributeFunc) {
            var t, ta, newEl, newTx, newCo, newCd, newAt, newPi, i, j, k;

            for (i = 3; i < arguments.length; i += 1) {
                t = arguments[i];
                if (t !== null && t !== undefined) {
                    if (Array.isArray(t)) {
                        for (j = 0; j < t.length; j += 1) {
                            addContent(xobj, putContentFunc, putAttributeFunc, t[j]);
                        }
                    } else if (t.select) {
                        ta = t.toArray();
                        for (k = 0; k < ta.length; k += 1) {
                            addContent(xobj, putContentFunc, putAttributeFunc, ta[k]);
                        }
                    } else if (t.isXEnumerable) {
                        ta = t.asEnumerable().toArray();
                        for (k = 0; k < ta.length; k += 1) {
                            addContent(xobj, putContentFunc, putAttributeFunc, ta[k]);
                        }
                    } else if (typeof t === 'object' && t.nodeType) {
                        if (t.nodeType === 'Element' ||
                                t.nodeType === 'Text' ||
                                t.nodeType === 'Comment' ||
                                t.nodeType === 'CDATA' ||
                                t.nodeType === 'ProcessingInstruction' ||
                                t.nodeType === 'Entity') {
                            if (t.parent && t.parent !== null) {
                                // then need to clone
                                if (t.nodeType === 'Element') {
                                    newEl = new Ltxml.XElement(t);
                                    newEl.parent = xobj;
                                    putContentFunc(newEl);
                                    return;
                                }
                                if (t.nodeType === 'Entity') {
                                    newTx = new Ltxml.XEntity(t);
                                    newTx.parent = xobj;
                                    putContentFunc(newTx);
                                    return;
                                }
                                if (t.nodeType === 'Text') {
                                    newTx = new Ltxml.XText(t);
                                    newTx.parent = xobj;
                                    putContentFunc(newTx);
                                    return;
                                }
                                if (t.nodeType === 'Comment') {
                                    newCo = new Ltxml.XComment(t);
                                    newCo.parent = xobj;
                                    putContentFunc(newCo);
                                    return;
                                }
                                if (t.nodeType === 'CDATA') {
                                    newCd = new Ltxml.XCData(t);
                                    newCd.parent = xobj;
                                    putContentFunc(newCd);
                                    return;
                                }
                                if (t.nodeType === 'ProcessingInstruction') {
                                    newPi = new Ltxml.XProcessingInstruction(t);
                                    newPi.parent = xobj;
                                    putContentFunc(newPi);
                                    return;
                                }
                            }
                            t.parent = xobj;
                            putContentFunc(t);
                            return;
                        }
                        if (t.nodeType === 'Attribute') {
                            if (t.parent && t.parent !== null) {
                                // then need to clone
                                newAt = new Ltxml.XAttribute(t);
                                newAt.parent = xobj;
                                putAttributeFunc(newAt);
                                return;
                            }
                            t.parent = xobj;
                            putAttributeFunc(t);
                            return;
                        }
                    } else {
                        if (typeof t === 'string' && t === '') {
                            newTx = new Ltxml.XText('');
                            newTx.parent = xobj;
                            putContentFunc(newTx);
                            return;
                        }
                        addContentThatCanContainEntities(t.toString(), xobj, true, putContentFunc);
                    }
                }
            }
        }

        entityCodePoints = [
            60,
            62,
            39,
            34,
            38
            /*,
            160,
            161,
            162,
            163,
            164,
            165,
            166,
            167,
            168,
            169,
            170,
            171,
            172,
            173,
            174,
            175,
            176,
            177,
            178,
            179,
            180,
            181,
            182,
            183,
            184,
            185,
            186,
            187,
            188,
            189,
            190,
            191,
            192,
            193,
            194,
            195,
            196,
            197,
            198,
            199,
            200,
            201,
            202,
            203,
            204,
            205,
            206,
            207,
            208,
            209,
            210,
            211,
            212,
            213,
            214,
            215,
            216,
            217,
            218,
            219,
            220,
            221,
            222,
            223,
            224,
            225,
            226,
            227,
            228,
            229,
            230,
            231,
            232,
            233,
            234,
            235,
            236,
            237,
            238,
            239,
            240,
            241,
            242,
            243,
            244,
            245,
            246,
            247,
            248,
            249,
            250,
            251,
            252,
            253,
            254,
            255,
            338,
            339,
            352,
            353,
            376,
            402,
            710,
            732,
            913,
            914,
            915,
            916,
            917,
            918,
            919,
            920,
            921,
            922,
            923,
            924,
            925,
            926,
            927,
            928,
            929,
            931,
            932,
            933,
            934,
            935,
            936,
            937,
            945,
            946,
            947,
            948,
            949,
            950,
            951,
            952,
            953,
            954,
            955,
            956,
            957,
            958,
            959,
            960,
            961,
            962,
            963,
            964,
            965,
            966,
            967,
            968,
            969,
            977,
            978,
            982,
            8194,
            8195,
            8201,
            8204,
            8205,
            8206,
            8207,
            8211,
            8212,
            8216,
            8217,
            8218,
            8220,
            8221,
            8222,
            8224,
            8225,
            8226,
            8230,
            8240,
            8242,
            8243,
            8249,
            8250,
            8254,
            8260,
            8364,
            8465,
            8472,
            8476,
            8482,
            8501,
            8592,
            8593,
            8594,
            8595,
            8596,
            8629,
            8656,
            8657,
            8658,
            8659,
            8660,
            8704,
            8706,
            8707,
            8709,
            8711,
            8712,
            8713,
            8715,
            8719,
            8721,
            8722,
            8727,
            8730,
            8733,
            8734,
            8736,
            8743,
            8744,
            8745,
            8746,
            8747,
            8756,
            8764,
            8773,
            8776,
            8800,
            8801,
            8804,
            8805,
            8834,
            8835,
            8836,
            8838,
            8839,
            8853,
            8855,
            8869,
            8901,
            8968,
            8969,
            8970,
            8971,
            9001,
            9002,
            9674,
            9824,
            9827,
            9829,
            9830 */
        ];

        entities = [
            "lt",
            "gt",
            "apos",
            "quot",
            "amp"
            /*,
            "nbsp",
            "iexcl",
            "cent",
            "pound",
            "curren",
            "yen",
            "brvbar",
            "sect",
            "uml",
            "copy",
            "ordf",
            "laquo",
            "not",
            "shy",
            "reg",
            "macr",
            "deg",
            "plusmn",
            "sup2",
            "sup3",
            "acute",
            "micro",
            "para",
            "middot",
            "cedil",
            "sup1",
            "ordm",
            "raquo",
            "frac14",
            "frac12",
            "frac34",
            "iquest",
            "Agrave",
            "Aacute",
            "Acirc",
            "Atilde",
            "Auml",
            "Aring",
            "AElig",
            "Ccedil",
            "Egrave",
            "Eacute",
            "Ecirc",
            "Euml",
            "Igrave",
            "Iacute",
            "Icirc",
            "Iuml",
            "ETH",
            "Ntilde",
            "Ograve",
            "Oacute",
            "Ocirc",
            "Otilde",
            "Ouml",
            "times",
            "Oslash",
            "Ugrave",
            "Uacute",
            "Ucirc",
            "Uuml",
            "Yacute",
            "THORN",
            "szlig",
            "agrave",
            "aacute",
            "acirc",
            "atilde",
            "auml",
            "aring",
            "aelig",
            "ccedil",
            "egrave",
            "eacute",
            "ecirc",
            "euml",
            "igrave",
            "iacute",
            "icirc",
            "iuml",
            "eth",
            "ntilde",
            "ograve",
            "oacute",
            "ocirc",
            "otilde",
            "ouml",
            "divide",
            "oslash",
            "ugrave",
            "uacute",
            "ucirc",
            "uuml",
            "yacute",
            "thorn",
            "yuml",
            "OElig",
            "oelig",
            "Scaron",
            "scaron",
            "Yuml",
            "fnof",
            "circ",
            "tilde",
            "Alpha",
            "Beta",
            "Gamma",
            "Delta",
            "Epsilon",
            "Zeta",
            "Eta",
            "Theta",
            "Iota",
            "Kappa",
            "Lambda",
            "Mu",
            "Nu",
            "Xi",
            "Omicron",
            "Pi",
            "Rho",
            "Sigma",
            "Tau",
            "Upsilon",
            "Phi",
            "Chi",
            "Psi",
            "Omega",
            "alpha",
            "beta",
            "gamma",
            "delta",
            "epsilon",
            "zeta",
            "eta",
            "theta",
            "iota",
            "kappa",
            "lambda",
            "mu",
            "nu",
            "xi",
            "omicron",
            "pi",
            "rho",
            "sigmaf",
            "sigma",
            "tau",
            "upsilon",
            "phi",
            "chi",
            "psi",
            "omega",
            "thetasym",
            "upsih",
            "piv",
            "ensp",
            "emsp",
            "thinsp",
            "zwnj",
            "zwj",
            "lrm",
            "rlm",
            "ndash",
            "mdash",
            "lsquo",
            "rsquo",
            "sbquo",
            "ldquo",
            "rdquo",
            "bdquo",
            "dagger",
            "Dagger",
            "bull",
            "hellip",
            "permil",
            "prime",
            "Prime",
            "lsaquo",
            "rsaquo",
            "oline",
            "frasl",
            "euro",
            "image",
            "weierp",
            "real",
            "trade",
            "alefsym",
            "larr",
            "uarr",
            "rarr",
            "darr",
            "harr",
            "crarr",
            "lArr",
            "uArr",
            "rArr",
            "dArr",
            "hArr",
            "forall",
            "part",
            "exist",
            "empty",
            "nabla",
            "isin",
            "notin",
            "ni",
            "prod",
            "sum",
            "minus",
            "lowast",
            "radic",
            "prop",
            "infin",
            "ang",
            "and",
            "or",
            "cap",
            "cup",
            "int",
            "there4",
            "sim",
            "cong",
            "asymp",
            "ne",
            "equiv",
            "le",
            "ge",
            "sub",
            "sup",
            "nsub",
            "sube",
            "supe",
            "oplus",
            "otimes",
            "perp",
            "sdot",
            "lceil",
            "rceil",
            "lfloor",
            "rfloor",
            "lang",
            "rang",
            "loz",
            "spades",
            "clubs",
            "hearts",
            "diams"
            */
        ];

        Ltxml.i = function (textToAdd, xobj, isElement, putContentFunc) {
            return addContentThatCanContainEntities(textToAdd, xobj, isElement, putContentFunc);
        }

        addContentThatCanContainEntities = function (textToAdd, xobj, isElement, putContentFunc) {
            var xt, xe, ts, tc, length, ch, ind;

            if (typeof textToAdd === 'string') {
                ts = 0;
                tc = 0;
                length = textToAdd.length;
                while (true) {
                    if (tc === length) {
                        break;
                    }
                    ch = textToAdd.charCodeAt(tc);
                    if ((ch >= 40 && ch <= 59) ||
                        (ch >= 63 && ch <= 126)) {
                        tc++;
                        continue;
                    }
                    if (ch >= 32 && ch <= 126 &&
                        ch !== 34 && ch !== 38 && ch !== 39 && ch !== 60 && ch !== 62) {
                        tc++;
                        continue;
                    }
                    if (ch === 9 || ch === 10 || ch === 13) {
                        if (isElement) {
                            tc++;
                            continue;
                        }
                    }
                    if (ch === 9 && !isElement) {
                        tc++;
                        continue;
                    }
                    if (ch < 32) {
                        if (ts !== tc) {
                            if (isElement) {
                                xt = new Ltxml.XText(textToAdd.substring(ts, tc));
                                xt.parent = xobj;
                            }
                            else {
                                xt = textToAdd.substring(ts, tc);
                            }
                            putContentFunc(xt);
                        }
                        xe = new Ltxml.XEntity("#x" + ch.toString(16));
                        xe.parent = xobj;
                        putContentFunc(xe);
                        tc++;
                        ts = tc;
                        continue;
                    }
                    ind = entityCodePoints.indexOf(ch);
                    if (ind === -1) {
                        tc++;
                        continue;
                    }
                    if (ts !== tc) {
                        if (isElement) {
                            xt = new Ltxml.XText(textToAdd.substring(ts, tc));
                            xt.parent = xobj;
                        }
                        else {
                            xt = textToAdd.substring(ts, tc);
                        }
                        putContentFunc(xt);
                    }
                    xe = new Ltxml.XEntity(entities[ind]);
                    xe.parent = xobj;
                    putContentFunc(xe);
                    tc++;
                    ts = tc;
                }
                if (ts !== tc) {
                    if (isElement) {
                        xt = new Ltxml.XText(textToAdd.substring(ts, tc));
                        xt.parent = xobj;
                    }
                    else {
                        xt = textToAdd.substring(ts, tc);
                    }
                    putContentFunc(xt);
                }
                return;
            }
            if (isElement) {
                xt = new Ltxml.XText(textToAdd);
                xt.parent = xobj;
                putContentFunc(xt);
            }
            else {
                putContentFunc(textToAdd);
            }
            return;
        };

        /********************** XNamespace **********************/

        // takes a string, returns an atomized object
        Ltxml.XNamespace = function (namespace, prefix) {
            var namespaceCache, nso, ns;

            namespaceCache = Ltxml.namespaceCache;

            if (prefix === null) {
                prefix = undefined;
            }
            if (namespaceCache[namespace] === undefined) {
                nso = {
                    namespaceName: namespace,
                    preferredPrefix: null,
                    getName: Ltxml.XNamespace.getName,
                    toString: Ltxml.XNamespace.toString
                };
                namespaceCache[namespace] = nso;
                return nso;
            }
            ns = namespaceCache[namespace];
            return ns;
        };

        Ltxml.XNamespace.getName = function (name) {
            return new Ltxml.XName(this.namespaceName, name);
        };

        Ltxml.XNamespace.toString = function () {
            if (this === Ltxml.XNamespace.getNone()) {
                return "";
            }
            return "{" + this.namespaceName + "}";
        };

        Ltxml.XNamespace.getNone = function () {
            var namespaceCache, namespace, nso;

            namespaceCache = Ltxml.namespaceCache;
            namespace = '__none';
            if (namespaceCache[namespace] === undefined) {
                nso = {
                    namespaceName: namespace,
                    preferredPrefix: null,
                    getName: Ltxml.XNamespace.getName,
                    toString: Ltxml.XNamespace.toString
                };
                namespaceCache[namespace] = nso;
                return nso;
            }
            return namespaceCache[namespace];
        };

        Ltxml.XNamespace.get = function (uri) {
            return new Ltxml.XNamespace(uri);
        };

        Ltxml.XNamespace.getXml = function () {
            return new Ltxml.XNamespace("http://www.w3.org/XML/1998/namespace", "xml");
        };

        Ltxml.XNamespace.getXmlns = function () {
            return new Ltxml.XNamespace("http://www.w3.org/2000/xmlns/", "xmlns");
        };

        if (Object.defineProperties) {

            Object.defineProperty(Ltxml.XNamespace, "none", {
                get: function () {
                    return Ltxml.XNamespace.getNone();
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(Ltxml.XNamespace, "xml", {
                get: function () {
                    return Ltxml.XNamespace.getXml();
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(Ltxml.XNamespace, "xmlns", {
                get: function () {
                    return Ltxml.XNamespace.getXmlns();
                },
                enumerable: true,
                configurable: true
            });

        }

        /********************** XName **********************/

        // for namespace, takes either a string or an atomized XNamespace object.
        // for name, takes a string
        Ltxml.XName = function (arg1, arg2) {
            var nameCache, expandedNamespaceObject, expandedNamespaceQName,
                namespaceOfExpandedName, noNamespaceObject, noNamespaceQName,
                noNamespaceNameObject, namespaceObject, namespaceQName,
                namespaceNameObject, indexOfClosingBrace;

            nameCache = Ltxml.nameCache;

            if (typeof arg1 === 'string' && arg2 === undefined && arg1.charAt(0) === '{') {
                indexOfClosingBrace = arg1.indexOf('}');
                namespaceOfExpandedName = arg1.substring(1, indexOfClosingBrace);
                expandedNamespaceObject = new Ltxml.XNamespace(namespaceOfExpandedName);
                arg2 = arg1.substring(indexOfClosingBrace + 1);
                expandedNamespaceQName = "{" + namespaceOfExpandedName + "}" + arg2;
                if (nameCache[expandedNamespaceQName] === undefined) {
                    nameCache[expandedNamespaceQName] = {
                        namespace: expandedNamespaceObject,
                        namespaceName: namespaceOfExpandedName,
                        localName: arg2,
                        toString: Ltxml.XName.toString
                    };
                    return nameCache[expandedNamespaceQName];
                }
                return nameCache[expandedNamespaceQName];
            }

            if (typeof arg1 === 'string' && arg2 === undefined) {
                noNamespaceObject = Ltxml.XNamespace.getNone();
                noNamespaceQName = "{" + noNamespaceObject.namespaceName + "}" + arg1;
                if (nameCache[noNamespaceQName] === undefined) {
                    noNamespaceNameObject = {
                        namespace: noNamespaceObject,
                        namespaceName: '',
                        localName: arg1,
                        toString: Ltxml.XName.toString
                    };
                    nameCache[noNamespaceQName] = noNamespaceNameObject;
                    return noNamespaceNameObject;
                }
                return nameCache[noNamespaceQName];
            }

            namespaceObject = arg1;
            if (typeof arg1 !== 'object') {
                namespaceObject = Ltxml.XNamespace(arg1);
            }
            namespaceQName = "{" + namespaceObject.namespaceName + "}" + arg2;
            if (nameCache[namespaceQName] === undefined) {
                namespaceNameObject = {
                    namespace: namespaceObject,
                    namespaceName: namespaceObject.namespaceName,
                    localName: arg2,
                    toString: Ltxml.XName.toString
                };
                nameCache[namespaceQName] = namespaceNameObject;
                return namespaceNameObject;
            }
            return nameCache[namespaceQName];
        };

        Ltxml.XName.toString = function () {
            return this.namespace + this.localName;
        };

        Ltxml.XName.qualify = function (xname, element, isAttribute) {
            if (xname.namespace === Ltxml.XNamespace.getNone()) {
                return xname.localName;
            }
            var prefix = element.getPrefixOfNamespace(xname.namespace, isAttribute);
            if (prefix === '') {
                return xname.localName;
            }
            return prefix + ":" + xname.localName;
        };

        Ltxml.XName.get = function (arg1, arg2) {
            var xn;

            if (typeof arg1 === 'string' && arg2 === undefined) {
                xn = new Ltxml.XName(arg1);
                return xn;
            }
            if ((typeof arg1 === 'string' || arg1.namespaceName) &&
                    typeof arg2 === 'string') {
                xn = new Ltxml.XName(arg1, arg2);
                return xn;
            }
            throw 'XName.get: invalid arguments';
        };

        /********************** XObject **********************/

        Ltxml.XObject = function () { };

        Ltxml.XObject.prototype.addAnnotation = function (type, object) {
            if (!object) {
                object = {};
            }
            this.annotationsArray.push({
                Type: type,
                Object: object
            });
        };

        Ltxml.XObject.prototype.annotation = function (type) {
            var i;

            for (i = 0; i < this.annotationsArray.length; i += 1) {
                if (this.annotationsArray[i].Type === type) {
                    return this.annotationsArray[i].Object;
                }
            }
            return null;
        };

        Ltxml.XObject.prototype.annotations = function (type) {
            var retVal, i;

            retVal = [];
            for (i = 0; i < this.annotationsArray.length; i += 1) {
                if (type === undefined || this.annotationsArray[i].Type === type) {
                    retVal.push(this.annotationsArray[i].Object);
                }
            }
            return Enumerable.from(retVal);
        };

        Ltxml.XObject.prototype.removeAnnotations = function (type) {
            var j;

            if (type === undefined) {
                this.annotationsArray = [];
            } else {
                while (true) {
                    for (j = 0; j < this.annotationsArray.length; j += 1) {
                        if (this.annotationsArray[j].Type === type) {
                            break;
                        }
                    }
                    if (j === this.annotationsArray.length) {
                        break;
                    }
                    this.annotationsArray.splice(j, 1);
                }
            }
        };

        Ltxml.XObject.prototype.getDocument = function () {
            var current = this;

            while (true) {
                if (current.nodeType === 'Document') {
                    return current;
                }
                current = current.parent;
                if (current === null) {
                    return null;
                }
            }
        };

        if (Object.defineProperties) {

            Object.defineProperty(Ltxml.XObject.prototype, "document", {
                get: function () {
                    return this.getDocument();
                },
                enumerable: true,
                configurable: true
            });

        }

        /********************** XNode: XObject **********************/

        Ltxml.XNode = function () { };

        Ltxml.XNode.prototype = new Ltxml.XObject();

        Ltxml.XNode.prototype.addAfterSelf = function () {
            var indexOfSelf, args, contentToInsert, newContent, i, z;

            args = [];
            newContent = [];

            if (this.parent === null) {
                throw "addAfterSelf: no parent element";
            }
            indexOfSelf = this.parent.nodesArray.indexOf(this);
            if (indexOfSelf === -1) {
                throw "Internal Error";
            }
            args = [];
            for (i = 0; i < arguments.length; i += 1) {
                args.push(arguments[i]);
            }
            contentToInsert = [];
            addContent(this,
                function (c) { contentToInsert.push(c); },
                function () { throw "addAfterSelf: invalid content"; },
                args);
            newContent = this.parent.nodesArray.slice(0, indexOfSelf + 1)
                .concat(contentToInsert)
                .concat(this.parent.nodesArray.slice(indexOfSelf + 1));
            for (z = 0; z < newContent.length; z += 1) {
                newContent[z].parent = this.parent;
            }
            this.parent.nodesArray = newContent;
        };

        Ltxml.XNode.prototype.addBeforeSelf = function () {
            var indexOfSelf, args, contentToInsert, newContent, i, z;

            args = [];
            contentToInsert = [];
            newContent = [];

            if (this.parent === null) {
                throw "addBeforeSelf: no parent element";
            }
            indexOfSelf = this.parent.nodesArray.indexOf(this);
            if (indexOfSelf === -1) {
                throw "Internal Error";
            }
            args = [];
            for (i = 0; i < arguments.length; i += 1) {
                args.push(arguments[i]);
            }
            contentToInsert = [];
            addContent(this,
                function (c) { contentToInsert.push(c); },
                function () { throw "addBeforeSelf: invalid content"; },
                args);
            newContent = this.parent.nodesArray.slice(0, indexOfSelf)
                .concat(contentToInsert)
                .concat(this.parent.nodesArray.slice(indexOfSelf));
            for (z = 0; z < newContent.length; z += 1) {
                newContent[z].parent = this.parent;
            }
            this.parent.nodesArray = newContent;
        };

        Ltxml.XNode.prototype.CompareDocumentOrder = function () {
            throw "Not implemented";
        };

        Ltxml.XNode.prototype.deepEquals = function (other) {
            var atts1, atts2, nodes1, nodes2;

            if (this.nodeType !== other.nodeType) {
                return false;
            }
            if (this.nodeType === 'Element' && this.name !== other.name) {
                return false;
            }
            if (this.nodeType === 'Comment' ||
                    this.nodeType === 'Text' ||
                    this.nodeType === 'CData' ||
                    this.nodeType === 'ProcessingInstruction' ||
                    this.nodeType === 'Entity') {
                return this.value === other.value;
            }
            if (this.attributesArray.length !== other.attributesArray.length) {
                return false;
            }

            if (this.attributesArray.length !== 0) {
                atts1 = Enumerable
                    .from(this.attributesArray)
                    .where(function (a) {
                        return !a.isNamespaceDeclaration;
                    })
                    .orderBy("k=>k.name");
                atts2 = Enumerable
                    .from(other.attributesArray)
                    .where(function (a) {
                        return !a.isNamespaceDeclaration;
                    })
                    .orderBy("k=>k.name");
                // in following lambda, return true if any do NOT match
                if (atts1.zip(atts2, function (a, b) {
                    return {
                    att1: a,
                    att2: b
                };
                })
                    .any(function (p) {
                        if (p.att1.name !== p.att2.name) {
                            return true;
                }
                        if (p.att1.value !== p.att2.value) {
                            return true;
                }
                        return false;
                })) {
                    return false;
                }
            }
            if (this.nodesArray.length !== other.nodesArray.length) {
                return false;
            }
            if (this.nodesArray.length === 0 && other.nodesArray.length === 0) {
                return true;
            }
            nodes1 = Enumerable.from(this.nodesArray);
            nodes2 = Enumerable.from(other.nodesArray);
            if (nodes1
                .zip(nodes2, function (a, b) {
                    return {
                node1: a,
                node2: b
            };
            })
                .any(function (z) { return !z.node1.deepEquals(z.node2); })) {
                return false;
            }
            return true;
        };

        Ltxml.XNode.prototype.isAfter = function () {
            throw "Not implemented";
        };

        Ltxml.XNode.prototype.isBefore = function () {
            throw "Not implemented";
        };

        Ltxml.XNode.prototype.getNextNode = function () {
            var indexOfSelf;

            if (this.parent === null) {
                throw "getNextNode: no parent element";
            }
            indexOfSelf = this.parent.nodesArray.indexOf(this);
            if (indexOfSelf === -1) {
                throw "Internal Error";
            }
            if (indexOfSelf < this.parent.nodesArray.length - 2) {
                return this.parent.nodesArray[indexOfSelf + 1];
            }
            return null;
        };

        Ltxml.XNode.prototype.remove = function () {
            var indexOfSelf, newContent;

            if (this.parent === null) {
                throw "remove: no parent element";
            }
            indexOfSelf = this.parent.nodesArray.indexOf(this);
            if (indexOfSelf === -1) {
                throw "Internal Error";
            }
            newContent = this.parent
                .nodesArray
                .slice(0, indexOfSelf)
                .concat(this.parent.nodesArray.slice(indexOfSelf + 1));
            this.parent.nodesArray = newContent;
        };

        Ltxml.XNode.prototype.replaceWith = function () {
            var indexOfSelf, newContent, args, contentToInsert, i, z;

            args = [];
            contentToInsert = [];
            if (this.parent === null) {
                throw "replaceWith: no parent element";
            }
            indexOfSelf = this.parent.nodesArray.indexOf(this);
            if (indexOfSelf === -1) {
                throw "Internal Error";
            }
            args = [];
            for (i = 0; i < arguments.length; i += 1) {
                args.push(arguments[i]);
            }
            contentToInsert = [];
            addContent(this,
                function (c) { contentToInsert.push(c); },
                function () { throw "replaceWith: invalid content"; },
                args);
            newContent = this.parent
                .nodesArray
                .slice(0, indexOfSelf)
                .concat(contentToInsert)
                .concat(this.parent.nodesArray.slice(indexOfSelf + 1));
            for (z = 0; z < newContent.length; z += 1) {
                newContent[z].parent = this.parent;
            }
            this.parent.nodesArray = newContent;
        };

        Ltxml.XNode.prototype.getPreviousNode = function () {
            var indexOfSelf;

            if (this.parent === null) {
                throw "previousNode: no parent element";
            }
            indexOfSelf = this.parent.nodesArray.indexOf(this);
            if (indexOfSelf === -1) {
                throw "Internal Error";
            }
            if (indexOfSelf > 0) {
                return this.parent.nodesArray[indexOfSelf - 1];
            }
            return null;
        };

        // xname optional
        Ltxml.XNode.prototype.ancestors = function (xname) {
            var self, result, current;

            self = this;

            if (xname && typeof xname === 'string') {
                xname = new Ltxml.XName(xname);
            }

            if (this.lazy) {
                return Enumerable.Utils.createEnumerable(function () {
                    var current;

                    return Enumerable.Utils.createEnumerator(
                        function () {
                            current = self.parent;
                        },  // initialize
                        function () { // tryGetNext
                            while (current !== null) {
                                if (xname && current.name !== xname) {
                                    current = current.parent;
                                } else {
                                    var thisOne = current;
                                    current = current.parent;
                                    return this.yieldReturn(thisOne);
                                }
                            }
                            return this.yieldBreak();
                        },
                        Functions.Blank
                    );
                });
            }
            result = [];
            current = this.parent;
            if (xname === undefined) {
                while (current !== null) {
                    result.push(current);
                    current = current.parent;
                }
                return Enumerable.from(result);
            }
            while (current !== null) {
                if (current.name === xname) {
                    result.push(current);
                }
                current = current.parent;
            }
            return Enumerable.from(result);
        };

        Ltxml.XNode.prototype.nodesAfterSelf = function () {
            var indexOfSelf, returnValue, self;

            self = this;
            if (this.parent === null) {
                throw "nodesAfterSelf: no parent element";
            }

            if (this.lazy) {
                return Enumerable.Utils.createEnumerable(function () {
                    var i, length, parent;

                    return Enumerable.Utils.createEnumerator(
                        function () {
                            parent = self.parent;
                            i = parent.nodesArray.indexOf(self) + 1;
                            length = parent.nodesArray.length;
                        },  // initialize
                        function () { // tryGetNext
                            var n;

                            while (i < length) {
                                n = parent.nodesArray[i];
                                i += 1;
                                return this.yieldReturn(n);  //ignore jslint
                            }
                            return this.yieldBreak();
                        },
                        Functions.Blank
                    );
                });
            }
            indexOfSelf = this.parent.nodesArray.indexOf(this);
            returnValue = Enumerable
                .from(this.parent.nodesArray.slice(indexOfSelf + 1));
            return returnValue;
        };

        Ltxml.XNode.prototype.nodesBeforeSelf = function () {
            var indexOfSelf, returnValue, self;

            self = this;
            if (this.parent === null) {
                throw "nodesBeforeSelf: no parent element";
            }

            if (this.lazy) {
                return Enumerable.Utils.createEnumerable(function () {
                    var parent, i, selfIndex;

                    return Enumerable.Utils.createEnumerator(
                        function () {
                            parent = self.parent;
                            i = 0;
                            selfIndex = parent.nodesArray.indexOf(self);
                        },  // initialize
                        function () { // tryGetNext
                            var n;

                            while (i < selfIndex) {
                                n = parent.nodesArray[i];
                                i += 1;
                                return this.yieldReturn(n);  //ignore jslint
                            }
                            return this.yieldBreak();
                        },
                        Functions.Blank
                    );
                });
            }
            if (this.parent === null) {
                throw "nodesBeforeSelf: no parent element";
            }
            indexOfSelf = this.parent.nodesArray.indexOf(this);
            if (indexOfSelf === -1) {
                throw "Internal Error";
            }
            returnValue = Enumerable
                .from(this.parent.nodesArray.slice(0, indexOfSelf));
            return returnValue;
        };

        // xname optional
        Ltxml.XNode.prototype.elementsAfterSelf = function (xname) {
            var indexOfSelf, returnValue, self;

            self = this;
            if (xname && typeof xname === 'string') {
                xname = new Ltxml.XName(xname);
            }
            if (this.parent === null) {
                throw "elementsAfterSelf: no parent element";
            }

            if (this.lazy) {
                return Enumerable.Utils.createEnumerable(function () {
                    var i, length, parent;

                    return Enumerable.Utils.createEnumerator(
                        function () {
                            parent = self.parent;
                            i = parent.nodesArray.indexOf(self) + 1;
                            length = parent.nodesArray.length;
                        },  // initialize
                        function () { // tryGetNext
                            while (i < length) {
                                var n = parent.nodesArray[i];
                                if (n.nodeType !== 'Element' || (xname && n.name !== xname)) {
                                    i += 1;
                                }
                                else {
                                    i += 1;
                                    return this.yieldReturn(n);
                                }
                            }
                            return this.yieldBreak();
                        },
                        Functions.Blank
                    );
                });
            }

            indexOfSelf = this.parent.nodesArray.indexOf(this);
            if (indexOfSelf === -1) {
                throw "Internal Error";
            }
            returnValue = Enumerable
                .from(this.parent.nodesArray.slice(indexOfSelf + 1))
                .where(function (e) { return e.nodeType === 'Element'; });
            if (xname) {
                returnValue = returnValue.where(function (e) { return e.name === xname; });
            }
            return returnValue;
        };

        // xname is optional
        Ltxml.XNode.prototype.elementsBeforeSelf = function (xname) {
            var indexOfSelf, returnValue, self;

            self = this;
            if (xname && typeof xname === 'string') {
                xname = new Ltxml.XName(xname);
            }
            if (this.parent === null) {
                throw "elementsBeforeSelf: no parent element";
            }

            if (this.lazy) {
                return Enumerable.Utils.createEnumerable(function () {
                    var parent, i, selfIndex;

                    return Enumerable.Utils.createEnumerator(
                        function () {
                            parent = self.parent;
                            i = 0;
                            selfIndex = parent.nodesArray.indexOf(self);
                        },  // initialize
                        function () { // tryGetNext
                            var n;

                            while (i < selfIndex) {
                                n = parent.nodesArray[i];
                                if (n.nodeType !== 'Element' || (xname && n.name !== xname)) {
                                    i += 1;
                                }
                                else {
                                    i += 1;
                                    return this.yieldReturn(n);
                                }
                            }
                            return this.yieldBreak();
                        },
                        Functions.Blank
                    );
                });
            }
            indexOfSelf = this.parent.nodesArray.indexOf(this);
            if (indexOfSelf === -1) {
                throw "Internal Error";
            }
            returnValue = Enumerable
                .from(this.parent.nodesArray.slice(0, indexOfSelf))
                .where(function (e) { return e.nodeType === 'Element'; });
            if (xname) {
                returnValue = returnValue.where(function (e) { return e.name === xname; });
            }
            return returnValue;
        };

        // xname is optional
        Ltxml.XNode.prototype.elementsBeforeSelfReverseDocumentOrder = function (xname) {
            var indexOfSelf, returnValue, self;

            self = this;
            if (xname && typeof xname === 'string') {
                xname = new Ltxml.XName(xname);
            }
            if (this.parent === null) {
                throw "elementsBeforeSelfReverseDocumentOrder: no parent element";
            }

            if (this.lazy) {
                return Enumerable.Utils.createEnumerable(function () {
                    var parent, i;

                    return Enumerable.Utils.createEnumerator(
                        function () {
                            parent = self.parent;
                            i = parent.nodesArray.indexOf(self) - 1;
                        },  // initialize
                        function () { // tryGetNext
                            while (i >= 0) {
                                var n = parent.nodesArray[i];
                                if (n.nodeType !== 'Element' || (xname && n.name !== xname)) {
                                    i -= 1;
                                }
                                else {
                                    i -= 1;
                                    return this.yieldReturn(n);
                                }
                            }
                            return this.yieldBreak();
                        },
                        Functions.Blank
                    );
                });
            }
            indexOfSelf = this.parent.nodesArray.indexOf(this);
            if (indexOfSelf === -1) {
                throw "Internal Error";
            }
            returnValue = Enumerable
                .from(this.parent.nodesArray.slice(0, indexOfSelf))
                .where(function (e) { return e.nodeType === 'Element'; })
                .reverse();
            if (xname) {
                returnValue = returnValue.where(function (e) { return e.name === xname; });
            }
            return returnValue;
        };

        if (Object.defineProperties) {

            Object.defineProperty(Ltxml.XNode.prototype, "previousNode", {
                get: function () {
                    return this.getPreviousNode();
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(Ltxml.XNode.prototype, "nextNode", {
                get: function () {
                    return this.getNextNode();
                },
                enumerable: true,
                configurable: true
            });

        }

        /********************** XAttribute: XObject **********************/

        Ltxml.XAttribute = function (arg1, arg2) {
            var xnameObj, attContent, i, xmlns;

            this.nodeType = 'Attribute';
            this.simpleValue = null;
            this.attributeNodesArray = null;
            this.isNamespaceDeclaration = false;
            this.name = null;

            if (Object.defineProperties) {

                Object.defineProperty(this, "value", {
                    get: Ltxml.XAttribute.prototype.getValue,
                    set: Ltxml.XAttribute.prototype.setValue,
                    enumerable: true,
                    configurable: true
                });

            }

            if (arg1.nodeType && arg1.nodeType === 'Attribute') {
                if (arg2 !== undefined) {
                    throw "XAttribute constructor: invalid arguments";
                }
                this.isNamespaceDeclaration = arg1.isNamespaceDeclaration;
                if (arg1.simpleValue !== null && arg1.simpleValue !== undefined) {
                    this.simpleValue = arg1.simpleValue;
                }
                else {
                    attContent = [];
                    for (i = 0; i < arg1.attributeNodesArray.length; i += 1) {
                        attContent.push(arg1.attributeNodesArray[i]);
                    }
                    this.attributeNodesArray = attContent;
                }
                this.name = arg1.name;
                return;
            }

            if (arg2 === undefined) {
                throw "XAttribute constructor: invalid arguments";
            }

            // external properties
            if (arg2.namespaceName) {
                this.attributeNodesArray = [arg2.namespaceName];
            }
            else {
                attContent = [];
                addContentThatCanContainEntities(arg2.toString(), this, false, function (c) {
                    attContent.push(c);
                });
                if (attContent.length === 1) {
                    this.simpleValue = attContent[0];
                }
                else {
                    this.attributeNodesArray = attContent;
                }
            }

            // constructor
            xnameObj = arg1;
            xmlns = Ltxml.XNamespace.getXmlns();
            if (typeof arg1 === 'string') {
                if (arg1 === "xmlns") {
                    xnameObj = new Ltxml.XName(xmlns + "xmlns");
                }
                else {
                    xnameObj = new Ltxml.XName(arg1);
                }
            }
            this.isNamespaceDeclaration = xnameObj.namespace === xmlns;
            this.name = xnameObj;
        };

        Ltxml.XAttribute.prototype = new Ltxml.XObject();

        serializeAttributeContent = function (a, o) {
            var na, i;

            if (a.simpleValue !== null && a.simpleValue !== undefined) {
                o.a(a.simpleValue);
            }
            else {
                na = a.attributeNodesArray;
                for (i = 0; i < na.length; i += 1) {
                    if (na[i].nodeType) {
                        na[i].serialize(o);
                    }
                    else {
                        o.a(na[i]);
                    }
                }
            }
        };

        Ltxml.XAttribute.prototype.serialize = function (o) {
            if (this.name.namespace === Ltxml.XNamespace.getXmlns()) {
                if (this.name.localName === 'xmlns') {
                    o.a("xmlns='");
                    serializeAttributeContent(this, o);
                    o.a("'");
                    return;
                }

                // ALEX change
                //o.a("xmlns:").a(this.name.localName).a("='");
                o.a("xmlns");
                if (this.name.localName)
                    o.a(":").a(this.name.localName);

                o.a("='");
                serializeAttributeContent(this, o);
                o.a("'");
                return;
            }
            if (this.name.namespace === Ltxml.XNamespace.getNone()) {
                o.a(this.name.localName).a("='");
                serializeAttributeContent(this, o);
                o.a("'");
                return;
            }
            if (this.name.namespace === Ltxml.XNamespace.getXml()) {
                if (typeof this.value === "string") {
                    o.a("xml:")
                        .a(this.name.localName)
                        .a("='");
                    serializeAttributeContent(this, o);
                    o.a("'");
                }
                else {
                    o.a("xml:")
                        .a(this.name.localName)
                        .a("='");
                    serializeAttributeContent(this, o);
                    o.a("'");
                }
                return;
            }
            o.a(Ltxml.XName.qualify(this.name, this.parent, true)).a("='");
            serializeAttributeContent(this, o);
            o.a("'");
            return;
        };

        Ltxml.XAttribute.prototype.toString = function () {
            var o = getStringBuilder();
            this.serialize(o);
            return o.toString();
        };

        Ltxml.XAttribute.prototype.remove = function () {
            var indexOfSelf, newAtts;

            newAtts = [];
            if (this.parent === null) {
                throw "XAttribute.remove: no parent element";
            }
            indexOfSelf = this.parent.attributesArray.indexOf(this);
            if (indexOfSelf === -1) {
                throw "Internal Error";
            }
            newAtts = this.parent
                .attributesArray
                .slice(0, indexOfSelf)
                .concat(this.parent.attributesArray.slice(indexOfSelf + 1));
            this.parent.attributesArray = newAtts;
        };

        Ltxml.XAttribute.prototype.setValue = function (value) {
            var newContent = [];
            addContentThatCanContainEntities(value.toString(), this, false, function (a) {
                newContent.push(a);
            });
            if (newContent.length === 1) {
                this.simpleValue = newContent[0];
            }
            else {
                this.attributeNodesArray = newContent;
            }
        };

        Ltxml.XAttribute.prototype.getValue = function () {
            var o, s;

            o = getStringBuilder();
            serializeAttributeContent(this, o);
            s = o.toString();
            return s;
        };

        Ltxml.XAttribute.prototype.getNextAttribute = function () {
            var indexOfSelf;

            if (this.parent === null) {
                throw "getNextAttribute: no parent element";
            }
            indexOfSelf = this.parent.attributesArray.indexOf(this);
            if (indexOfSelf === -1) {
                throw "Internal Error";
            }
            if (indexOfSelf < this.parent.attributesArray.length - 2) {
                return this.parent.attributesArray[indexOfSelf + 1];
            }
            return null;
        };

        Ltxml.XAttribute.prototype.getPreviousAttribute = function () {
            var indexOfSelf;

            if (!this.parent) {
                throw "getPreviousAttribute: no parent element";
            }
            indexOfSelf = this.parent.attributesArray.indexOf(this);
            if (indexOfSelf === -1) {
                throw "Internal Error";
            }
            if (indexOfSelf > 0) {
                return this.parent.attributesArray[indexOfSelf - 1];
            }
            return null;
        };

        if (Object.defineProperties) {

            Object.defineProperty(Ltxml.XAttribute.prototype, "previousAttribute", {
                get: function () {
                    return this.getPreviousAttribute();
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(Ltxml.XAttribute.prototype, "nextAttribute", {
                get: function () {
                    return this.getNextAttribute();
                },
                enumerable: true,
                configurable: true
            });

        }

        /********************** XComment: XNode **********************/

        Ltxml.XComment = function (arg1) {
            this.nodeType = 'Comment';
            this.parent = null;

            if (arg1.nodeType && arg1.nodeType === 'Comment') {
                // copy constructor
                this.value = arg1.value.toString();
            }
            else {
                this.value = arg1.toString();
            }
        };

        Ltxml.XComment.prototype = new Ltxml.XNode();

        Ltxml.XComment.prototype.serialize = function (o, indent, depth) {
            var indent_spaces;

            if (!depth) {
                depth = 0;
            }
            if (indent) {
                indent_spaces = Array(depth + 1).join(Ltxml.spaces);
                o.a(indent_spaces).a("<!--").a(this.value).a("-->\n");
                return;
            }
            o.a('<!--').a(this.value).a('-->');
            return;
        };

        Ltxml.XComment.prototype.toString = function (indent) {
            var o = getStringBuilder();
            this.serialize(o, indent);
            return o.toString();
        };

        /********************** XContainer: XNode **********************/

        Ltxml.XContainer = function () { };

        Ltxml.XContainer.prototype = new Ltxml.XNode();

        Ltxml.XContainer.prototype.add = function () {
            var nodesToInsert, attributesToInsert, args, i, newNodes, newAttributes;

            nodesToInsert = [];
            attributesToInsert = [];
            args = [];

            for (i = 0; i < arguments.length; i += 1) {
                args.push(arguments[i]);
            }
            nodesToInsert = [];
            addContent(this,
                function (c) { nodesToInsert.push(c); },
                function (a) { attributesToInsert.push(a); },
                args);
            newNodes = this.nodesArray.concat(nodesToInsert);
            newAttributes = this.attributesArray.concat(attributesToInsert);
            this.nodesArray = newNodes;
            this.attributesArray = newAttributes;
        };

        Ltxml.XContainer.prototype.addFirst = function () {
            var nodesToInsert, attributesToInsert, args, i, newNodes, newAttributes;

            nodesToInsert = [];
            attributesToInsert = [];
            args = [];
            for (i = 0; i < arguments.length; i += 1) {
                args.push(arguments[i]);
            }
            nodesToInsert = [];
            addContent(this,
                function (c) { nodesToInsert.push(c); },
                function (a) { attributesToInsert.push(a); },
                args);
            newNodes = nodesToInsert.concat(this.nodesArray);
            newAttributes = this.attributesArray.concat(attributesToInsert);
            this.nodesArray = newNodes;
            this.attributesArray = newAttributes;
        };

        Ltxml.XContainer.prototype.element = function (name) {
            var i, length;

            if (typeof name === 'string') {
                name = new Ltxml.XName(name);
            }
            length = this.nodesArray.length;
            for (i = 0; i < length; i += 1) {
                if (this.nodesArray[i].name === name) {
                    return this.nodesArray[i];
                }
            }
            return null;
        };

        Ltxml.XContainer.prototype.nodes = function () {
            return Enumerable.from(this.nodesArray);
        };

        Ltxml.XContainer.prototype.removeNodes = function () {
            this.nodesArray = [];
        };

        Ltxml.XContainer.prototype.replaceNodes = function () {
            var nodesToInsert, attributesToInsert, args, i, newAttributes;

            nodesToInsert = [];
            attributesToInsert = [];
            args = [];
            for (i = 0; i < arguments.length; i += 1) {
                args.push(arguments[i]);
            }
            addContent(this,
                function (c) { nodesToInsert.push(c); },
                function (a) { attributesToInsert.push(a); },
                args);
            newAttributes = this.attributesArray.concat(attributesToInsert);
            this.nodesArray = nodesToInsert;
            this.attributesArray = newAttributes;
        };

        Ltxml.XContainer.prototype.getFirstNode = function () {
            if (this.nodesArray.length >= 1) {
                return this.nodesArray[0];
            }
            return null;
        };

        Ltxml.XContainer.prototype.getLastNode = function () {
            if (this.nodesArray.length >= 1) {
                return this.nodesArray[this.nodesArray.length - 1];
            }
            return null;
        };

        function descendantNodesHelper(element, pushFunc) {
            var i;

            for (i = 0; i < element.nodesArray.length; i += 1) {
                pushFunc(element.nodesArray[i]);
                if (element.nodesArray[i].nodeType === 'Element') {
                    descendantNodesHelper(element.nodesArray[i], pushFunc);
                }
            }
        }

        Ltxml.XContainer.prototype.descendantNodes = function () {
            var result, returnValue;

            if (this.lazy) {
                returnValue = Enumerable
                    .from(this.nodesArray)
                    .traverseDepthFirst(function (node) {
                        return Enumerable.from(node.nodesArray);
                    });
                return returnValue;
            }
            result = [];
            descendantNodesHelper(this, function (e) { result.push(e); });
            return Enumerable.from(result);
        };

        function lazyDescendantHelper(container, xname) {
            var returnValue = Enumerable
                .from(container.nodesArray)
                .traverseDepthFirst(function (node) {
                    return Enumerable.from(node.nodesArray).where(function (node) {
                        return node.nodeType === 'Element';
                    });
                })
                .where(function (node) { return node.nodeType === 'Element'; });
            if (xname) {
                returnValue = returnValue.where(function (e) { return e.name === xname; });
            }
            return returnValue;
        }

        function eagarDescendantHelper(container, xname, pushFunc) {
            var i;

            for (i = 0; i < container.nodesArray.length; i += 1) {
                if (container.nodesArray[i].nodeType === 'Element') {
                    if (xname === undefined) {
                        pushFunc(container.nodesArray[i]);
                        eagarDescendantHelper(container.nodesArray[i], xname, pushFunc);
                    }
                    else {
                        if (container.nodesArray[i].name === xname) {
                            pushFunc(container.nodesArray[i]);
                        }
                        eagarDescendantHelper(container.nodesArray[i], xname, pushFunc);
                    }
                }
            }
        }

        // xname optional
        Ltxml.XContainer.prototype.descendants = function (xname) {
            var result;

            if (xname && typeof xname === 'string') {
                xname = new Ltxml.XName(xname);
            }
            if (this.lazy) {
                return lazyDescendantHelper(this, xname);
            }
            result = [];
            eagarDescendantHelper(this, xname, function (e) { result.push(e); });
            return Enumerable.from(result);
        };

        // xname optional
        Ltxml.XContainer.prototype.elements = function (xname) {
            var returnValue, self;

            self = this;
            if (xname && typeof xname === 'string') {
                xname = new Ltxml.XName(xname);
            }

            if (this.lazy) {
                return Enumerable.Utils.createEnumerable(function () {
                    var i, length;

                    return Enumerable.Utils.createEnumerator(
                        function () {
                            i = 0;
                            length = self.nodesArray.length;
                        },  // initialize
                        function () { // tryGetNext
                            while (i < length) {
                                var n = self.nodesArray[i];
                                if (n.nodeType !== 'Element' || (xname && n.name !== xname)) {
                                    i += 1;
                                }
                                else {
                                    i += 1;
                                    return this.yieldReturn(n);
                                }
                            }
                            return this.yieldBreak();
                        },
                        Functions.Blank
                    );
                });
            }
            if (xname) {
                returnValue = Enumerable
                    .from(this.nodesArray)
                    .where(function (e) { return e.nodeType === 'Element' && e.name === xname; });
            }
            else {
                returnValue = Enumerable
                    .from(this.nodesArray)
                    .where(function (e) { return e.nodeType === 'Element'; });
            }
            return returnValue;
        };

        if (Object.defineProperties) {

            Object.defineProperty(Ltxml.XContainer.prototype, "firstNode", {
                get: function () {
                    return this.getFirstNode();
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(Ltxml.XContainer.prototype, "lastNode", {
                get: function () {
                    return this.getLastNode();
                },
                enumerable: true,
                configurable: true
            });

        }

        /*********************** XDeclaration ***********************/

        //new XDeclaration(version, encoding, standalone)
        //new XDeclaration(xdeclaration)
        Ltxml.XDeclaration = function (arg1, arg2, arg3) {
            if (arg1 && typeof arg1 === 'object' && arguments.length === 1) {
                this.type = 'XDeclaration';
                this.encoding = arg1.encoding ? arg1.encoding : ''; //ignore jslint
                this.standalone = arg1.standalone ? arg1.standalone : ''; //ignore jslint
                this.version = arg1.version ? arg1.version : ''; //ignore jslint
                return;
            }
            if (arguments.length === 3) {
                this.type = 'XDeclaration';
                this.version = arg1;
                this.encoding = arg2;
                this.standalone = arg3;
                return;
            }
            this.type = 'XDeclaration';
            this.version = '';
            this.encoding = '';
            this.standalone = '';
        };

        Ltxml.XDeclaration.prototype.serialize = function (o, indent) {
            if (this.version || this.encoding || this.standalone) {
                if (indent) {
                    o.a("<?xml");
                    if (this.version) {
                        o.a(" version=\"").a(this.version).a("\"");
                    }
                    if (this.encoding) {
                        o.a(" encoding=\"").a(this.encoding).a("\"");
                    }
                    if (this.standalone) {
                        o.a(" standalone=\"").a(this.standalone).a("\"");
                    }
                    o.a("?>\n");
                    return;
                }
                o.a("<?xml");
                if (this.version) {
                    o.a(" version=\"").a(this.version).a("\"");
                }
                if (this.encoding) {
                    o.a(" encoding=\"").a(this.encoding).a("\"");
                }
                if (this.standalone) {
                    o.a(" standalone=\"").a(this.standalone).a("\"");
                }
                o.a("?>");
                return;
            }
            return;
        };

        Ltxml.XDeclaration.prototype.toString = function (indent) {
            var o = getStringBuilder();
            this.serialize(o, indent);
            return o.toString();
        };

        /********************** XDocument: XContainer **********************/

        //new XDocument()
        //new XDocument(content)
        //new XDocument(xdocument)
        //new XDocument(xdeclaration, content)
        Ltxml.XDocument = function (arg1) {
            var tempNodes, tempNodes2, start, args, i;

            this.annotationsArray = [];
            this.parent = null;
            this.nodeType = 'Document';
            this.nodesArray = [];
            this.declaration = new Ltxml.XDeclaration();

            if (typeof arg1 === 'object' && arg1.nodeType && arg1.nodeType === 'Document') {
                if (arguments.length > 1) {
                    throw "XDocument constructor: invalid arguments";
                }
                tempNodes = [];
                if (arg1.declaration !== null) {
                    this.declaration = new Ltxml.XDeclaration(arg1.declaration);
                }
                addContent(this,
                            function (z) { tempNodes.push(z); },
                            function () { throw "Internal Error"; },
                            arg1.nodesArray);
                this.nodesArray = tempNodes;
                return;
            }

            if (arguments.length > 0) {
                if (typeof arg1 === 'object' && arg1.type && arg1.type === 'XDeclaration') {
                    start = 1;
                    this.declaration = arg1;
                }
                else {
                    start = 0;
                }
                args = [];
                for (i = start; i < arguments.length; i += 1) {
                    args.push(arguments[i]);
                }
                tempNodes2 = [];
                addContent(this,
                                function (z) { tempNodes2.push(z); },
                                function () { throw "Internal Error"; },
                                args);
                this.nodesArray = tempNodes2;
            }
        };

        Ltxml.XDocument.prototype = new Ltxml.XContainer();

        Ltxml.XDocument.prototype.serialize = function (o, indent) {
            var i;

            if (indent) {
                this.declaration.serialize(o, true);
                for (i = 0; i < this.nodesArray.length; i += 1) {
                    this.nodesArray[i].serialize(o, true);
                }
                return;
            }
            this.declaration.serialize(o, false);
            for (i = 0; i < this.nodesArray.length; i += 1) {
                this.nodesArray[i].serialize(o, false);
            }
            return;
        };

        Ltxml.XDocument.prototype.toString = function (indent) {
            var clone, o, newRoot;

            o = getStringBuilder();
            clone = new Ltxml.XDocument(this.declaration,
                this.nodes().select(function (n) {
                    if (n.nodeType === 'Element') {
                        newRoot = new Ltxml.XElement(n);
                        annotateRootForNamespaces(newRoot);
                        return newRoot;
                    }
                    return n;
                }));

            clone.serialize(o, indent);
            return o.toString();
        };

        Ltxml.XDocument.parse = function (xml) {
            var xmlDoc, e;

            xmlDoc = parseXml(xml);
            e = Ltxml.XDocument.load(xmlDoc);
            return e;
        };

        Ltxml.XDocument.prototype.DocumentType = function () {
            throw "Not implemented";
        };

        /*
        function xmlNodeLoad(node, depth) {
            var ns, xn, aa, aa2, cn, cn2, el, at, doc,
                xcd, xcm, pi, xdec, cnt1, cnt2, cnt3, tn, newAtt,
                cn_doc, cnt4, nc, version, encoding, standalone;

            if (node.nodeType) {
                if (node.nodeType === 1) {
                    if (node.namespaceURI === null ||
                        node.namespaceURI === undefined ||
                        (node.namespaceURI === "" && node.nodeName !== "xmlns")) {
                        ns = Ltxml.XNamespace.getNone();
                    }
                    else {
                        ns = new Ltxml.XNamespace(
                            node.namespaceURI,
                            node.prefix && node.prefix !== "" ?
                                node.prefix.toString() :
                                null);
                    }
                    if (node.localName) {
                        xn = new Ltxml.XName(ns, node.localName);
                    }
                    else {
                        xn = new Ltxml.XName(ns, node.baseName);
                    }

                    aa = node.attributes;
                    cn = node.childNodes;

                    if (aa !== null && aa !== undefined && aa.length > 0) {
                        cn2 = [];
                        for (cnt1 = 0; cnt1 < cn.length; cnt1 += 1) {
                            tn = xmlNodeLoad(cn[cnt1], depth + 1);
                            cn2.push(tn);
                        }
                        aa2 = [];
                        for (cnt2 = 0; cnt2 < aa.length; cnt2 += 1) {
                            newAtt = xmlNodeLoad(aa[cnt2], depth + 1);
                            aa2.push(newAtt);
                        }
                        el = new Ltxml.XElement(xn, aa2, cn2);
                    }
                    else {
                        cn2 = [];
                        for (cnt3 = 0; cnt3 < cn.length; cnt3 += 1) {
                            cn2.push(xmlNodeLoad(cn[cnt3], depth + 1));
                        }
                        el = new Ltxml.XElement(xn, cn2);
                    }
                    return el;
                }

                if (node.nodeType === 2) {
                    if (node.namespaceURI === null || node.namespaceURI === undefined ||
                            (node.namespaceURI === "" && node.prefix !== "xmlns")) {
                        if (node.prefix === "xml") {
                            ns = Ltxml.XNamespace.getXml();
                        }
                        else {
                            ns = Ltxml.XNamespace.getNone();
                        }
                    }
                    else {
                        if (node.namespaceURI === "http://www.w3.org/2000/xmlns/" ||
                                node.prefix === "xmlns") {
                            ns = Ltxml.XNamespace.getXmlns();
                        }
                        else if (node.namespaceURI ===
                                "http://www.w3.org/XML/1998/namespace") {
                            ns = Ltxml.XNamespace.getXml();
                        }
                        else {
                            ns = new Ltxml.XNamespace(
                                node.namespaceURI,
                                    node.prefix ?
                                    node.prefix.toString() :
                                    null);
                        }
                    }
                    if (node.localName) {
                        xn = new Ltxml.XName(ns, node.localName);
                    }
                    else {
                        if (node.nodeName === "xmlns") {
                            xn = new Ltxml.XName(ns, "xmlns");
                        }
                        else {
                            xn = new Ltxml.XName(ns, node.baseName);
                        }
                    }
                    at = new Ltxml.XAttribute(xn, node.nodeValue);
                    return at;
                }

                if (node.nodeType === 3) {
                    nc = [];
                    addContentThatCanContainEntities(node.nodeValue, null, true, function (c) {
                        nc.push(c);
                    });
                    return nc;
                }

                if (node.nodeType === 4) {
                    xcd = new Ltxml.XCData(node.nodeValue);
                    return xcd;
                }

                if (node.nodeType === 7) {
                    if (node.target === 'xml') {
                        return null;
                    }
                    pi = new Ltxml.XProcessingInstruction(node.target, node.data);
                    return pi;
                }

                if (node.nodeType === 8) {
                    xcm = new Ltxml.XComment(node.nodeValue);
                    return xcm;
                }

                if (node.nodeType === 9) {
                    version = node.xmlVersion;
                    encoding = node.xmlEncoding;
                    standalone = node.xmlStandalone;
                    if (!version) { version = "1.0"; }
                    if (!encoding) { encoding = "UTF-8"; }
                    if (!standalone) { standalone = "yes"; }
                    xdec = new Ltxml.XDeclaration(
                        version,
                        encoding,
                        standalone ? "yes" : "no");
                    cn = node.childNodes;
                    cn_doc = [];
                    for (cnt4 = 0; cnt4 < cn.length; cnt4 += 1) {
                        cn_doc.push(xmlNodeLoad(cn[cnt4], depth + 1));
                    }
                    doc = new Ltxml.XDocument(xdec, cn_doc);
                    return doc;
                }
            }

            throw ("Internal Error");
        }

        Ltxml.XDocument.load = function (document) {
            var d = xmlNodeLoad(document);
            return d;
        };
        */

        Ltxml.XDocument.prototype.getRoot = function () {
            return Enumerable
                .from(this.nodesArray)
                .firstOrDefault(function (f) {
                    return f.nodeType === 'Element';
                });
        };

        // xname is optional
        Ltxml.XDocument.prototype.descendants = function (xname) {
            var result;

            if (xname && typeof xname === 'string') {
                xname = new Ltxml.XName(xname);
            }

            if (this.lazy) {
                return lazyDescendantHelper(this, xname);
            }
            // not lazy
            if (xname && typeof xname === 'string') {
                xname = new Ltxml.XName(xname);
            }
            result = [];
            eagarDescendantHelper(this, xname, function (e) { result.push(e); });
            return Enumerable.from(result);
        };

        if (Object.defineProperties) {

            Object.defineProperty(Ltxml.XDocument.prototype, "root", {
                get: function () {
                    return this.getRoot();
                },
                enumerable: true,
                configurable: true
            });

        }

        /********************** XElement: XContainer **********************/

        // new XElement(xelement)         // copy constructor
        // new XElement(xname)
        // new XElement(xname, content)
        Ltxml.XElement = function (arg1) {
            var tempNodes, tempAtts, tempNodes2, tempAtts2, xnameObj, args, i;

            this.annotationsArray = [];
            this.parent = null;
            this.nodeType = 'Element';
            this.nodesArray = null;
            this.attributesArray = null;
            this.name = null;
            this.nsCache = null;

            if (Object.defineProperties) {

                Object.defineProperty(this, "value", {
                    get: Ltxml.XElement.prototype.getValue,
                    set: Ltxml.XElement.prototype.setValue,
                    enumerable: true,
                    configurable: true
                });

            }

            if (typeof arg1 === 'object' && arg1.nodeType && arg1.nodeType === 'Element') {
                if (arguments.length > 1) {
                    throw "XElement constructor: invalid arguments";
                }
                this.name = arg1.name;
                tempNodes = [];
                tempAtts = [];
                addContent(this,
                            function (z) { tempNodes.push(z); },
                            function (z) { tempAtts.push(z); },
                            arg1.attributesArray,
                            arg1.nodesArray);
                this.attributesArray = tempAtts;
                this.nodesArray = tempNodes;
                return;
            }

            xnameObj = arg1;
            if (typeof arg1 === 'string') {
                xnameObj = new Ltxml.XName(arg1);
            }
            this.name = xnameObj;
            if (arguments.length > 1) {
                args = [];
                for (i = 1; i < arguments.length; i += 1) {
                    args.push(arguments[i]);
                }
                tempNodes2 = [];
                tempAtts2 = [];
                addContent(this,
                            function (z) { tempNodes2.push(z); },
                            function (z) { tempAtts2.push(z); },
                            args);
                this.attributesArray = tempAtts2;
                this.nodesArray = tempNodes2;
            }
            if (this.nodesArray === null) {
                this.nodesArray = [];
            }
            if (this.attributesArray === null) {
                this.attributesArray = [];
            }
        };

        Ltxml.XElement.prototype = new Ltxml.XContainer();

        Ltxml.XElement.prototype.attribute = function (xname) {
            var i;

            if (xname && typeof xname === 'string') {
                xname = new Ltxml.XName(xname);
            }
            for (i = 0; i < this.attributesArray.length; i += 1) {
                if (this.attributesArray[i].name === xname) {
                    return this.attributesArray[i];
                }
            }
            return null;
        };

        Ltxml.XElement.prototype.attributes = function (xname) {
            var atts;

            if (xname && typeof xname === 'string') {
                xname = new Ltxml.XName(xname);
            }

            if (xname === undefined) {
                atts = Enumerable.from(this.attributesArray);
                return atts;
            }
            // have XName
            atts = Enumerable.from(this.attributesArray)
                .where(function (a) { return a.name === xname; });
            return atts;
        };

        Ltxml.XElement.prototype.serialize = function (o, indent, depth) {
            var attributesToUse, indent_spaces, middle_take, mixed_content,
                attribute_indent_spaces, qn, as, bs, i, n;

            if (!depth) {
                depth = 0;
            }
            qn = Ltxml.XName.qualify(this.name, this, false);
            attributesToUse = [].concat(this.attributesArray);
            attributesToUse.sort(function (a, b) {
                as = a.name.toString();
                bs = b.name.toString();
                if (as < bs) {
                    return -1;
                }
                if (as > bs) {
                    return 1;
                }
                return 0;
            });
            if (this.nodesArray.length === 0) {
                // ================================ content:no
                if (indent) {
                    // ================================ content:no indent:yes
                    indent_spaces = Array(depth + 1).join(Ltxml.spaces);
                    if (attributesToUse.length === 0) {
                        // ============ content:no indent:yes attributes:no
                        o.a(indent_spaces).a("<").a(qn).a("/>\n");
                        return;
                    }
                    if (attributesToUse.length === 1) {
                        // ================================ content:no indent:yes attributes:1
                        o.a(indent_spaces).a("<").a(qn).a(" ")
                            .a(attributesToUse[0]).a("/>\n");
                        return;
                    }
                    // ================================ content:no indent:yes attributes:*
                    attribute_indent_spaces = indent_spaces +
                         Array(3 + qn.length).join(Ltxml.spaces);
                        //Ltxml.spaces.substring(0, 2 + qn.length);
                    middle_take = attributesToUse.length - 2;
                    o.a(indent_spaces).a("<").a(qn).a(" ");
                    attributesToUse[0].serialize(o);
                    o.a("\n");
                    Enumerable.from(attributesToUse)
                        .skip(1)
                        .take(middle_take)
                        .forEach(function (a) {
                            o.a(attribute_indent_spaces);
                            a.serialize(o);
                            o.a("\n");
                        });
                    o.a(attribute_indent_spaces);
                    attributesToUse[attributesToUse.length - 1].serialize(o);
                    o.a("/>\n");
                    return;
                }
                // ================================ content:no indent:no
                o.a("<").a(qn).a(attributesToUse.length === 0 ? "" : " ");
                for (i = 0; i < attributesToUse.length; i += 1) {
                    attributesToUse[i].serialize(o);
                    if (i < attributesToUse.length - 1) {
                        o.a(' ');
                    }
                }
                o.a("/>");
                return;
            }
            // ================================ content:yes
            if (indent) {
                // ================================ content:yes indent:yes
                indent_spaces = Array(depth + 1).join(Ltxml.spaces);// Ltxml.spaces.substring(0, depth);
                mixed_content = false;
                for (i = 0; i < this.nodesArray.length; ++i) {
                    n = this.nodesArray[i];
                    if ((n.nodeType === 'Text' && n.value !== '') ||
                        n.nodeType === 'Entity') {
                        mixed_content = true;
                        break;
                    }
                }
                //mixed_content = (this.nodesArray[0].nodeType === 'Text' ||
                //    this.nodesArray[0].nodeType === 'CDATA' ||
                //    this.nodesArray[0].nodeType === 'Entity');
                if (mixed_content) {
                    // =============== content:yes indent:yes first_child_text:yes
                    if (attributesToUse.length === 0) {
                        // ========== content:yes indent:yes first_child_text:yes attributes:0
                        o.a(indent_spaces).a("<").a(qn).a(">");
                        for (i = 0; i < this.nodesArray.length; i += 1) {
                            this.nodesArray[i].serialize(o);
                        }
                        o.a("</").a(qn).a(">\n");
                        return;
                    }
                    if (attributesToUse.length === 1) {
                        // ========= content:yes indent:yes first_child_text:yes attributes:1
                        o.a(indent_spaces).a("<").a(qn).a(" ");
                        attributesToUse[0].serialize(o);
                        o.a(">");
                        for (i = 0; i < this.nodesArray.length; i += 1) {
                            this.nodesArray[i].serialize(o, false);
                        }
                        o.a("</").a(qn).a(">\n");
                        return;
                    }
                    // ============ content:yes indent:yes first_child_text:yes attributes:*
                    attribute_indent_spaces = indent_spaces +
                         Array(3 + qn.length).join(Ltxml.spaces);
                        //Ltxml.spaces.substring(0, 2 + qn.length);
                    middle_take = attributesToUse.length - 2;
                    o.a(indent_spaces).a("<").a(qn).a(" ");
                    attributesToUse[0].serialize(o);
                    o.a("\n");
                    Enumerable.from(attributesToUse)
                        .skip(1)
                        .take(middle_take)
                        .forEach(function (a) { o.a(attribute_indent_spaces).a(a).a("\n"); });
                    o.a(attribute_indent_spaces);
                    attributesToUse[attributesToUse.length - 1].serialize(o);
                    o.a(">");
                    Enumerable.from(this.nodesArray)
                                .forEach(function (c) { c.serialize(o, false); });
                    o.a("</").a(qn).a(">\n");
                    // following is implementation that does not use LINQ
                    // var first = indent_spaces + "<" + qn + " " + attributesToUse[0] + "\n";
                    // var atum = [];
                    // for (var i = 1; i < attributesToUse.length - 1; i += 1) {
                    //     atum.push(attributesToUse[i]);
                    // }
                    // var z9 = '';
                    // for (var j = 0; j < atum.length; j += 1) {
                    //     z9 += attribute_indent_spaces + atum[j].toString() + "\n";
                    // }
                    // var second = z9;

                    // var third = attribute_indent_spaces +
                    //     attributesToUse[attributesToUse.length - 1] + ">" +
                    //             Enumerable.from(this.nodesArray)
                    //                 .select(function (c) { return c.serialize(false) })
                    //        .aggregate('', function (a, b) { return a + b; }) +
                    //                   "</" + qn + ">\n";
                    // var es = first + second + third;
                    return;
                }
                // ================================ content:yes indent:yes first_child_text:no
                if (attributesToUse.length === 0) {
                    // =============== content:yes indent:yes first_child_text:no attributes:0
                    o.a(indent_spaces).a("<").a(qn).a(">\n");
                    Enumerable.from(this.nodesArray)
                        .forEach(function (c) { c.serialize(o, true, depth + 2); });
                    o.a(indent_spaces).a("</").a(qn).a(">\n");
                    return;
                }
                if (attributesToUse.length === 1) {
                    // ============== content:yes indent:yes first_child_text:no attributes:1
                    o.a(indent_spaces).a("<").a(qn).a(" ");
                    attributesToUse[0].serialize(o);
                    o.a(">\n");
                    Enumerable.from(this.nodesArray)
                        .forEach(function (c) { c.serialize(o, true, depth + 2); });
                    o.a(indent_spaces).a("</").a(qn).a(">\n");
                    return;
                }
                // ================ content:yes indent:yes first_child_text:no attributes:*
                attribute_indent_spaces = indent_spaces +
                    Array(3 + qn.length).join(Ltxml.spaces);
                    //Ltxml.spaces.substring(0, 2 + qn.length);
                middle_take = attributesToUse.length - 2;
                o.a(indent_spaces).a("<").a(qn).a(" ");
                attributesToUse[0].serialize(o);
                o.a("\n");
                Enumerable.from(attributesToUse)
                            .skip(1)
                            .take(middle_take)
                            .forEach(function (a) {
                                o.a(attribute_indent_spaces); a.serialize(o); o.a("\n");
                            });
                o.a(attribute_indent_spaces);
                attributesToUse[attributesToUse.length - 1].serialize(o);
                o.a(">\n");
                Enumerable.from(this.nodesArray)
                    .forEach(function (c) { c.serialize(o, true, depth + 2); });
                o.a(indent_spaces).a("</").a(qn).a(">\n");
                return;
            }
            // ================================ content:yes indent:no
            o.a("<").a(qn);
            Enumerable.from(attributesToUse)
                .forEach(function (a) { o.a(" "); a.serialize(o); });
            o.a(">");
            Enumerable.from(this.nodesArray)
                .forEach(function (n) { n.serialize(o); });
            o.a("</").a(qn).a(">");
            return;
        };

        function cloneCache(original) {
            var len, clonedCache;

            clonedCache = {
                prefixesFromNamespaceObjects: false,
                namespaceArray: [],
                prefixArray: []
            };
            len = original.namespaceArray.length;
            clonedCache.namespaceArray = original.namespaceArray.slice(0, len);
            clonedCache.prefixArray = original.prefixArray.slice(0, len);
            return clonedCache;
        }

        function annotateElementForNamespaces(element, nsCache, xmlns, xml, none) {
            var needToProcess, aa, na, ns, len, i, j, nd, newNsCache, el, prefix, nn, localNamespaceCacheLen,
                newPrefix, newAtt, workingNsCache, index;

            needToProcess = false;

            // The code in this method always examines and modifies the workingNsCache.  If there is no need to
            // modify the local namespace cache, then workingNsCache will always be set to the inherited local
            // namespace cache.  If this method needs to modify the local namespace cache, then it will clone the
            // local namespace cache and set workingNsCache to the cloned cache.  If this method were to modify the
            // inherited local namespace cache, then it would be modifying the namespace cache for all ancestor
            // elements that currently are using that specific namespace cache.
            workingNsCache = nsCache;

            // If there are any namespace attributes where the prefix does not match the current prefix in use for
            // that namespace, then this method will need to build a new local namespace cache.
            aa = element.attributesArray;
            len = aa.length;
            for (i = 0; i < len; i += 1) {
                nd = aa[i];
                if (nd.isNamespaceDeclaration) {
                    ns = new Ltxml.XNamespace(nd.value);
                    prefix = nd.name.localName;
                    if (workingNsCache.prefixesFromNamespaceObjects && prefix !== ns.preferredPrefix) {
                        if (workingNsCache === nsCache) {
                            workingNsCache = cloneCache(nsCache);
                        }
                        index = workingNsCache.prefixArray.indexOf(prefix);
                        if (index !== -1) {
                            workingNsCache.namespaceArray[index] = ns;
                        }
                        else {
                            workingNsCache.namespaceArray.push(ns);
                            workingNsCache.prefixArray.push(prefix);
                        }
                        needToProcess = true;
                        break;
                    }
                    else {
                        index = workingNsCache.namespaceArray.indexOf(ns);
                        if (index === -1 || prefix !== workingNsCache.prefixArray[index]) {
                            if (workingNsCache === nsCache) {
                                workingNsCache = cloneCache(nsCache);
                            }
                            index = workingNsCache.prefixArray.indexOf(prefix);
                            if (index !== -1) {
                                workingNsCache.namespaceArray[index] = ns;
                            }
                            needToProcess = true;
                            break;
                        }
                    }
                }
            }

            // If there are any attributes that are in a namespace and if the attribute is not defined with
            // a prefix, then fabricate a prefix, and add it as an attribute to the element, then clone
            // the local namespace cache and add the namespace with prefix to the local namespace cache.
            for (i = 0; i < len; i += 1) {
                nd = aa[i];
                if (!nd.isNamespaceDeclaration && nd.name.namespace !== none && nd.name.namespace !== xml) {

                    localNamespaceCacheLen = workingNsCache.namespaceArray.length;
                    index = -1;
                    for (j = 0; j < localNamespaceCacheLen; ++j) {
                        if (workingNsCache.namespaceArray[j] === nd.name.namespace && workingNsCache.prefixArray[j] !== "xmlns") {
                            index = j;
                            break;
                        }
                    }

                    if (index === -1) {
                        while (true) {
                            newPrefix = "p" + prefixCounter;
                            if (workingNsCache.prefixArray.indexOf(newPrefix) === -1) {
                                break;
                            }
                            prefixCounter += 1;
                        }
                        newAtt = new Ltxml.XAttribute(Ltxml.XNamespace.getXmlns() + newPrefix,
                            nd.name.namespace.namespaceName);
                        element.add(newAtt);
                        if (workingNsCache === nsCache) {
                            workingNsCache = cloneCache(nsCache);
                        }
                        workingNsCache.namespaceArray.push(nd.name.namespace);
                        workingNsCache.prefixArray.push(newPrefix);
                        needToProcess = true;
                    }
                }
            }

            // If the element is in a namespace and that namespace is not in the local namespace cache
            // (either as the default namespace or as a namespace with a prefix), then fabricate a prefix,
            // add an attribute to the element, clone the local namespace cache, and add the namespace to
            // the local namespace cache.
            if (element.name.namespace !== none && workingNsCache.namespaceArray.indexOf(element.name.namespace) === -1) {

                if (autoGeneratePrefixes) {
                    while (true) {
                        newPrefix = "p" + prefixCounter;
                        if (workingNsCache.prefixArray.indexOf(newPrefix) === -1) {
                            break;
                        }
                        prefixCounter += 1;
                    }
                }
                else {
                    newPrefix = "";
                }
                
                newAtt = new Ltxml.XAttribute(Ltxml.XNamespace.getXmlns() + newPrefix, element.name.namespace.namespaceName);
                element.add(newAtt);
                if (workingNsCache === nsCache) {
                    workingNsCache = cloneCache(nsCache);
                }
                workingNsCache.namespaceArray.push(element.name.namespace);
                workingNsCache.prefixArray.push(newPrefix);
                needToProcess = true;
            }

            // If the element is in no namespace and if there is a default namespace, then add an attribute
            // to the element that unbinds the default namespace.
            if (element.name.namespace === none) {
                index = workingNsCache.prefixArray.indexOf("xmlns");
                // if there is a default namespace
                if (index !== -1) {
                    if (workingNsCache.namespaceArray[index] !== none) {
                        // If there is no namespace attribute that undeclares the default namespace
                        if (!Enumerable.from(element.attributesArray).any(function (a) {
                            return a.name.namespace === xmlns && a.name.localName === "xmlns" && a.value === "";
                        })) {
                            // Then add a namespace attribute that undeclares the default namespace.
                            nn = new Ltxml.XAttribute("xmlns", "");
                            element.add(nn);
                            needToProcess = true;
                        }
                    }
                }
            }

            //// If it is necessary to build a new local namespace cache...
            if (needToProcess) {

                // Create a new local namespace cache.
                newNsCache = {
                    prefixesFromNamespaceObjects: false,
                    namespaceArray: [],
                    prefixArray: []
                };

                // Go through all namespace attributes and add all namespace declarations to the new
                // local namespace cache.
                aa = element.attributesArray;
                len = aa.length;
                for (i = 0; i < len; i += 1) {
                    nd = aa[i];
                    if (nd.isNamespaceDeclaration) {
                        if (nd.value === "") {
                            ns = none;
                        }
                        else {
                            ns = new Ltxml.XNamespace(nd.value);
                        }
                        prefix = nd.name.localName;
                        newNsCache.namespaceArray.push(ns);
                        newNsCache.prefixArray.push(prefix);
                    }
                }

                // For all namespaces in the inherited local namespace cache, if the namespace is not already
                // in the new local namespace cache, then add it.
                for (i = 0; i < workingNsCache.namespaceArray.length; i += 1) {
                    if (newNsCache.namespaceArray.indexOf(workingNsCache.namespaceArray[i]) === -1) {
                        // If there already is a namespace with the same prefix in the local namespace cache,
                        // then don't copy the namespace from the inherited local namespace cache into the new
                        // local namespace cache.
                        if (newNsCache.prefixArray.indexOf(workingNsCache.prefixArray[i]) === -1) {
                            newNsCache.namespaceArray.push(workingNsCache.namespaceArray[i]);
                            newNsCache.prefixArray.push(workingNsCache.prefixArray[i]);
                        }
                    }
                }

                // Annotate the element with the new local namespace cache.
                element.nsCache = newNsCache;

                // Recursivly annotate descendant elements.
                na = element.nodesArray;
                len = na.length;
                for (j = 0; j < len; j += 1) {
                    el = na[j];
                    if (el.nodeType === 'Element') {
                        annotateElementForNamespaces(el, newNsCache, xmlns, xml, none);
                    }
                }
                return;
            }

            // Annotate the element with the inherited local namespace cache.
            element.nsCache = workingNsCache;

            // Recursivly annotate descendant elements.
            na = element.nodesArray;
            len = na.length;
            for (j = 0; j < len; j += 1) {
                el = na[j];
                if (el.nodeType === 'Element') {
                    annotateElementForNamespaces(el, workingNsCache, xmlns, xml, none);
                }
            }
        }

        annotateRootForNamespaces = function (rootElement) {
            var aa, na, len, i, j, nd, newPrefix, newAtt, index, aalen,
                nsCache, ns, prefix, el, xmlns, none, xml;

            // Clear the preferred prefix for all namespaces in the global namespace cache.
            xmlns = Ltxml.XNamespace.getXmlns();
            none = Ltxml.XNamespace.getNone();
            xml = Ltxml.XNamespace.getXml();
            for (ns in Ltxml.namespaceCache) {
                if (Ltxml.namespaceCache.hasOwnProperty(ns)) {
                    if (Ltxml.namespaceCache[ns].namespaceName) {
                        Ltxml.namespaceCache[ns].preferredPrefix = null;
                    }
                }
            }

            // Initialize the local namespace cache.
            prefixCounter = 0;
            nsCache = {
                prefixesFromNamespaceObjects: true,
                namespaceArray: [],
                prefixArray: []
            };

            // Add all namespace attributes at the root level to the local namespace cache, and set the
            // preferred prefix in the global namespace cache.
            aa = rootElement.attributesArray;
            len = aa.length;
            for (i = 0; i < len; i += 1) {
                nd = aa[i];
                if (nd.isNamespaceDeclaration) {
                    ns = new Ltxml.XNamespace(nd.value);
                    prefix = nd.name.localName;
                    ns.preferredPrefix = prefix;
                    nsCache.namespaceArray.push(ns);
                    nsCache.prefixArray.push(prefix);
                }
            }

            // For all non-namespace attributes of the root element, if the namespace of the attribute is not in
            // the local namespace cache, then fabricate a prefix and add it.
            for (i = 0; i < len; i += 1) {
                nd = aa[i];
                if (!nd.isNamespaceDeclaration &&
                    nd.name.namespace !== none &&
                    nd.name.namespace !== xml) {
                    index = -1;
                    aalen = nsCache.namespaceArray.length;
                    for (j = 0; j < aalen; ++j) {
                        if (nsCache.namespaceArray[j] === nd.name.namespace && nsCache.prefixArray[j] !== "xmlns") {
                            index = j;
                            break;
                        }
                    }
                    if (index === -1) {
                        while (true) {
                            newPrefix = "p" + prefixCounter;
                            if (nsCache.prefixArray.indexOf(newPrefix) === -1) {
                                break;
                            }
                            prefixCounter += 1;
                        }
                        newAtt = new Ltxml.XAttribute(Ltxml.XNamespace.getXmlns() + newPrefix,
                            nd.name.namespace.namespaceName);
                        rootElement.add(newAtt);
                        nsCache.namespaceArray.push(nd.name.namespace);
                        nsCache.prefixArray.push(newPrefix);
                        nd.name.namespace.preferredPrefix = newPrefix;
                    }
                }
            }

            // If the namespace for the root element is not in the local namespace cache,
            // fabricate a prefix and add it.
            if (rootElement.name.namespace !== none && nsCache.namespaceArray.indexOf(rootElement.name.namespace) === -1) {
                if (autoGeneratePrefixes) {
                    while (true) {
                        newPrefix = "p" + prefixCounter;
                        if (nsCache.prefixArray.indexOf(newPrefix) === -1) {
                            break;
                        }
                        prefixCounter += 1;
                    }
                }
                else {
                    newPrefix = '';
                }

                newAtt = new Ltxml.XAttribute(Ltxml.XNamespace.getXmlns() + newPrefix, rootElement.name.namespace.namespaceName);
                rootElement.add(newAtt);
                nsCache.namespaceArray.push(rootElement.name.namespace);
                
                nsCache.prefixArray.push(newPrefix);
                rootElement.name.namespace.preferredPrefix = newPrefix;
            }

            // Set the local namespace cache for the root element.
            rootElement.nsCache = nsCache;

            // Recursively annotate descendant elements.
            na = rootElement.nodesArray;
            len = na.length;
            for (j = 0; j < len; j += 1) {
                el = na[j];
                if (el.nodeType === 'Element') {
                    annotateElementForNamespaces(el, nsCache, xmlns, xml, none);
                }
            }
        };

        Ltxml.XElement.prototype.toString = function (indent) {
            var clone, o;

            if (indent === undefined)
                indent = true;
            o = getStringBuilder();
            clone = new Ltxml.XElement(this);
            annotateRootForNamespaces(clone);
            clone.serialize(o, indent, 0);
            return o.toString();
        };


        Ltxml.XElement.load = function (element) {
            var el = xmlNodeLoad(element);
            return el;
        };

        Ltxml.XElement.prototype.getFirstAttribute = function () {
            if (this.attributesArray.length > 0) {
                return this.attributesArray[0];
            }
            return null;
        };

        Ltxml.XElement.prototype.getDefaultNamespaceHelper = function () {
            var attributesToUse, defNamespaceAtt;

            attributesToUse = [].concat(this.attributesArray);
            defNamespaceAtt = Enumerable
                .from(attributesToUse)
                .where(function (a) { return a.isNamespaceDeclaration; })
                .firstOrDefault(function (a) {
                    return a.name.namespace === Ltxml.XNamespace.getXmlns() &&
                    a.name.localName === "xmlns";
                });
            return defNamespaceAtt;
        };

        Ltxml.XElement.prototype.getDefaultNamespace = function (namespace) {
            var current, dna;

            current = this;
            while (true) {
                dna = current.getDefaultNamespaceHelper(namespace);
                if (dna !== null) {
                    return new Ltxml.XNamespace(dna.value);
                }
                current = current.parent;
                if (current === null || current.nodeType === 'Document') {
                    return Ltxml.XNamespace.getNone();
                }
            }
        };

        Ltxml.XElement.prototype.getNamespaceOfPrefixForThisElement = function (prefix) {
            var a = Enumerable.from(this.attributesArray)
                .firstOrDefault(function (a) {
                    return a.isNamespaceDeclaration &&
                        a.name.namespace === Ltxml.XNamespace.getXmlns() &&
                        a.name.localName === prefix;
                });
            return a;
        };

        Ltxml.XElement.prototype.getNamespaceOfPrefix = function (prefix) {
            var current, ns;

            current = this;
            while (true) {
                ns = current.getNamespaceOfPrefixForThisElement(prefix);
                if (ns !== null) {
                    return ns;
                }
                current = current.parent;
                if (current === null || current.nodeType === 'Document') {
                    return null;
                }
            }
        };

        prefixCounter = 0;

        Ltxml.XElement.prototype.getPrefixOfNamespace = function (namespace, isAttribute) {
            var current, prefix, nsCache, prefixesFromNamespaceObjects, index,
                newPrefix, newAtt;

            current = this;
            nsCache = this.nsCache;

            // If the code is in the mode of retrieving prefixes from namespace objects, and if
            // the namespace object has a preferredPrefix, then return it.
            prefixesFromNamespaceObjects = nsCache.prefixesFromNamespaceObjects;
            if (prefixesFromNamespaceObjects && namespace.preferredPrefix) {
                if (namespace.preferredPrefix === "xmlns") {
                    return "";
                }
                return namespace.preferredPrefix;
            }
            if (isAttribute === undefined) {
                isAttribute = false;
            }

            index = nsCache.namespaceArray.indexOf(namespace);

            if (index === -1) {
                //return '';
                throw ("Local namespace cache is invalid");
            }

            // If the namespace is for an element, and if the namespace is the default namespace,
            // then return the empty string.
            if (!isAttribute) {
                if (index !== -1 && nsCache.prefixArray[index] === "xmlns") {
                    return '';
                }
            }

            prefix = nsCache.prefixArray[index];
            return prefix;  //ignore jslint
        };

        Ltxml.XElement.prototype.getHasAttributes = function () {
            return this.attributesArray && this.attributesArray.length > 0;
        };

        Ltxml.XElement.prototype.getHasElements = function () {
            return Enumerable.from(this.nodesArray).any(function (n) {
                return n.nodeType === 'Element';
            });
        };

        Ltxml.XElement.prototype.getIsEmpty = function () {
            return this.nodesArray.length === 0;
        };

        Ltxml.XElement.prototype.getLastAttribute = function () {
            if (this.attributesArray.length > 0) {
                return this.attributesArray[this.attributesArray.length - 1];
            }
            return null;
        };

        Ltxml.XElement.parse = function (xml) {
            var xmlDoc, el;

            xmlDoc = parseXml(xml);
            el = Ltxml.XElement.load(xmlDoc.documentElement);
            return el;
        };

        Ltxml.XElement.prototype.removeAll = function () {
            this.nodesArray = [];
            this.attributesArray = [];
        };

        Ltxml.XElement.prototype.removeAttributes = function () {
            this.attributesArray = [];
        };

        Ltxml.XElement.prototype.replaceAll = function () {
            var args, contentToInsert, i;

            args = [];
            contentToInsert = [];

            args = [];
            for (i = 0; i < arguments.length; i += 1) {
                args.push(arguments[i]);
            }
            contentToInsert = [];
            addContent(this,
                function (c) { contentToInsert.push(c); },
                function () { throw "replaceAll: invalid content"; },
                args);
            this.nodesArray = contentToInsert;
        };

        Ltxml.XElement.prototype.replaceAttributes = function () {
            var args, contentToInsert, i;

            args = [];
            contentToInsert = [];

            args = [];
            for (i = 0; i < arguments.length; i += 1) {
                args.push(arguments[i]);
            }
            contentToInsert = [];
            addContent(this,
                function () { throw "replaceAttributes: invalid content"; },
                function (a) { contentToInsert.push(a); },
                args);
            this.attributesArray = contentToInsert;
        };

        Ltxml.XElement.prototype.setAttributeValue = function (xname, value) {
            var xa;

            if (typeof xname === 'string') {
                xname = new Ltxml.XName(xname);
            }
            xa = this.attribute(xname);
            if (xa !== null) {
                if (value === null) {
                    if (xa.parent !== null) {
                        xa.remove();
                    }
                    return;
                }
                xa.setValue(value);
                return;
            }
            xa = new Ltxml.XAttribute(xname, value);
            xa.parent = this;
            this.attributesArray.push(xa);
        };

        Ltxml.XElement.prototype.setElementValue = function (xname, value) {
            var xe, nc;

            if (typeof xname === 'string') {
                xname = new Ltxml.XName(xname);
            }
            xe = this.element(xname);
            if (xe !== null) {
                if (value === null) {
                    if (xe.parent !== null) {
                        xe.remove();
                    }
                    return;
                }
                nc = [];
                addContentThatCanContainEntities(value, xe, true, function (v) {
                    nc.push(v);
                });
                xe.nodesArray = nc;
                return;
            }
            xe = new Ltxml.XElement(xname, value);
            xe.parent = this;
            this.nodesArray.push(xe);
        };

        Ltxml.XElement.prototype.setValue = function (value) {
            var nc = [];
            addContentThatCanContainEntities(value.toString(), this, true, function (c) {
                nc.push(c);
            });
            this.nodesArray = nc;
        };

        Ltxml.XElement.prototype.getValue = function () {
            var returnValue = this
                .descendantNodes()
                .where(function (n) {
                    return n.nodeType === 'Text' ||
                    n.nodeType === 'CDATA' ||
                    n.nodeType === 'Entity';
                })
                .select(function (n) { return n.value; })
                .toArray()
                .join('');
            return returnValue;
        };

        Ltxml.XElement.prototype.ancestorsAndSelf = function (xname) {
            var result, current, self;

            self = this;
            if (xname && typeof xname === 'string') {
                xname = new Ltxml.XName(xname);
            }

            if (this.lazy) {
                return Enumerable.Utils.createEnumerable(function () {
                    var current;

                    return Enumerable.Utils.createEnumerator(
                        function () {
                            current = self;
                        },  // initialize
                        function () { // tryGetNext
                            while (current !== null) {
                                if (xname && current.name !== xname) {
                                    current = current.parent;
                                }
                                else {
                                    var thisOne = current;
                                    current = current.parent;
                                    return this.yieldReturn(thisOne);
                                }
                            }
                            return this.yieldBreak();
                        },
                        Functions.Blank
                    );
                });
            }
            result = [];
            current = this.parent;
            if (xname === undefined) {
                result.push(this);
                while (current !== null) {
                    result.push(current);
                    current = current.parent;
                }
                return Enumerable.from(result);
            }
            if (this.name === xname) {
                result.push(this);
            }
            while (current !== null) {
                if (current.name === xname) {
                    result.push(current);
                }
                current = current.parent;
            }
            return Enumerable.from(result);
        };

        function descendantNodesAndSelfHelper(element, pushFunc) {
            var i;

            for (i = 0; i < element.nodesArray.length; i += 1) {
                pushFunc(element.nodesArray[i]);
                if (element.nodesArray[i].nodeType === 'Element' ||
                        element.nodesArray[i].nodeType === 'Document') {
                    descendantNodesAndSelfHelper(element.nodesArray[i], pushFunc);
                }
            }
        }

        Ltxml.XElement.prototype.descendantNodesAndSelf = function () {
            var result, returnValue;

            if (this.lazy) {
                returnValue = Enumerable
                    .from(this.nodesArray)
                    .traverseDepthFirst(function (node) {
                        return Enumerable.from(node.nodesArray);
                    });
                return Enumerable.from([this]).concat(returnValue);
            }

            result = [];
            result.push(this);
            descendantNodesAndSelfHelper(this, function (e) { result.push(e); });
            return Enumerable.from(result);
        };

        // xname is optional
        Ltxml.XElement.prototype.descendantsAndSelf = function (xname) {
            var result, self;

            if (xname && typeof xname === 'string') {
                xname = new Ltxml.XName(xname);
            }

            if (this.lazy) {
                if (!xname) {
                    self = Enumerable.from([this]);
                }
                else {
                    if (xname === this.name) {
                        self = Enumerable.from([this]);
                    }
                    else {
                        self = Enumerable.from([]);
                    }
                }
                return self.concat(lazyDescendantHelper(this, xname));
            }
            result = [];
            if (!xname) {
                result.push(this);
            }
            else {
                if (xname === this.name) {
                    result.push(this);
                }
            }
            eagarDescendantHelper(this, xname, function (e) { result.push(e); });
            return Enumerable.from(result);
        };

        if (Object.defineProperties) {

            Object.defineProperty(Ltxml.XElement.prototype, "firstAttribute", {
                get: function () {
                    return this.getFirstAttribute();
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(Ltxml.XElement.prototype, "hasAttributes", {
                get: function () {
                    return this.getHasAttributes();
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(Ltxml.XElement.prototype, "hasElements", {
                get: function () {
                    return this.getHasElements();
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(Ltxml.XElement.prototype, "isEmpty", {
                get: function () {
                    return this.getIsEmpty();
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(Ltxml.XElement.prototype, "lastAttribute", {
                get: function () {
                    return this.getLastAttribute();
                },
                enumerable: true,
                configurable: true
            });
        }

        /********************* XProcessingInstruction: XNode *********************/

        //new XProcessingInstruction(xprocessingInstruction)
        //new XProcessingInstruction(target, data)
        Ltxml.XProcessingInstruction = function (arg1, arg2) {
            this.nodeType = 'ProcessingInstruction';
            this.parent = null;
            this.target = null;
            this.data = null;

            if (arg1 && arg1.nodeType && arg1.nodeType === 'ProcessingInstruction') {
                if (arg1.target) {
                    this.target = arg1.target;
                }
                if (arg1.data) {
                    this.data = arg1.data;
                }
            }
            else {
                this.target = arg1;
                this.data = arg2;
            }
        };

        Ltxml.XProcessingInstruction.prototype = new Ltxml.XNode();

        Ltxml.XProcessingInstruction.prototype.serialize = function (o, indent, depth) {
            var indent_spaces;

            if (!depth) {
                depth = 0;
            }
            if (indent) {
                indent_spaces = Array(depth + 1).join(Ltxml.spaces);// Ltxml.spaces.substring(0, depth);
                o.a(indent_spaces).a("<?").a(this.target).a(" ").a(this.data).a("?>\n");
                return;
            }
            o.a("<?").a(this.target).a(" ").a(this.data).a("?>");
            return;
        };

        Ltxml.XProcessingInstruction.prototype.toString = function (indent) {
            var o = getStringBuilder();
            this.serialize(o, indent);
            return o.toString();
        };

        /********************** XText: XNode **********************/

        Ltxml.XText = function (arg1) {
            this.nodeType = 'Text';
            this.parent = null;

            if (arg1 && arg1.nodeType && arg1.nodeType === 'Text') {
                // copy constructor
                this.value = arg1.value.toString();
            }
            else {
                this.value = arg1;
            }

            // methods
            this.serialize = function (o) {
                o.a(this.value);
            };

            this.toString = function () {
                return this.value;
            };
        };

        Ltxml.XText.prototype = new Ltxml.XNode();

        /********************** XEntity: XNode **********************/

        Ltxml.XEntity = function (arg1) {
            this.nodeType = 'Entity';
            this.parent = null;

            if (arg1 && arg1.nodeType && arg1.nodeType === 'Entity') {
                // copy constructor
                this.value = arg1.value;
            }
            else {
                if (typeof arg1 === 'string') {
                    this.value = arg1;
                }
                else {
                    this.value = arg1.toString();
                }
            }

            // methods
            this.serialize = function (o) {
                var s = "&" + this.value + ";";
                o.a(s);
            };

            this.toString = function () {
                return "&" + this.value + ";";
            };
        };

        Ltxml.XEntity.prototype = new Ltxml.XNode();

        /******************* XCData: XText *******************/

        Ltxml.XCData = function (arg1) {
            this.nodeType = 'CDATA';
            this.parent = null;

            if (arg1 && arg1.nodeType && arg1.nodeType === 'CDATA') {
                // copy constructor
                this.value = arg1.value.toString();
            }
            else {
                this.value = arg1.toString();
            }
        };

        Ltxml.XCData.prototype = new Ltxml.XText();

        Ltxml.XCData.prototype.serialize = function (o, indent, depth) {
            var indent_spaces;

            if (!depth) {
                depth = 0;
            }
            if (indent) {
                indent_spaces = Array(depth + 1).join(Ltxml.spaces);// Ltxml.spaces.substring(0, depth);
                o.a(indent_spaces).a('<![CDATA[').a(this.value).a(']]>\n');
                return;
            }
            o.a('<![CDATA[').a(this.value).a(']]>');
            return;
        };

        Ltxml.XCData.prototype.toString = function (indent) {
            var o = getStringBuilder();
            this.serialize(o, indent);
            return o.toString();
        };


        /********************** Extension methods (XEnumerable) **********************/

        //Ltxml.XEnumerable = function (source) {
        //    this.source = source;
        //    this.isXEnumerable = true;
        //};

        //Ltxml.XEnumerable.prototype = new Enumerable();

        //Ltxml.XEnumerable.prototype.getEnumerator = function () {
        //    return this.source.getEnumerator();
        //};

        //Ltxml.XEnumerable.prototype.asEnumerable = function () {
        //    return this.source;
        //};

        //Enumerable.prototype.asXEnumerable = function () {
        //    return new Ltxml.XEnumerable(this);
        //};

        //Ltxml.XEnumerable.prototype.ancestors = function (xname) {
        //    var source, result;

        //    if (xname && typeof xname === 'string') {
        //        xname = new Ltxml.XName(xname);
        //    }

        //    source = this.source ? this.source : this;  //ignore jslint
        //    result = source
        //        .selectMany(
        //            function (e) {
        //                if (e.nodeType &&
        //                    (e.nodeType === 'Element' ||
        //                        e.nodeType === 'Comment' ||
        //                        e.nodeType === 'ProcessingInstruction' ||
        //                        e.nodeType === 'Text' ||
        //                        e.nodeType === 'CDATA' ||
        //                        e.nodeType === 'Entity')) {
        //                    return e.ancestors(xname);
        //                }
        //                return Enumerable.empty();
        //            })
        //        .asXEnumerable();
        //    return result;
        //};

        //Ltxml.XEnumerable.prototype.ancestorsAndSelf = function (xname) {
        //    var source, result;

        //    if (xname && typeof xname === 'string') {
        //        xname = new Ltxml.XName(xname);
        //    }
        //    source = this.source ? this.source : this;  //ignore jslint
        //    result = source
        //        .selectMany(
        //            function (e) {
        //                if (e.nodeType && e.nodeType === 'Element') {
        //                    return e.ancestorsAndSelf(xname);
        //                }
        //                return Enumerable.empty();
        //            })
        //        .asXEnumerable();
        //    return result;
        //};

        //Ltxml.XEnumerable.prototype.attributes = function (xname) {
        //    var source, result;

        //    if (xname && typeof xname === 'string') {
        //        xname = new Ltxml.XName(xname);
        //    }
        //    source = this.source ? this.source : this;  //ignore jslint
        //    result = source
        //        .selectMany(
        //            function (e) {
        //                if (e.nodeType && e.nodeType === 'Element') {
        //                    return e.attributes(xname);
        //                }
        //                return Enumerable.empty();
        //            })
        //        .asXEnumerable();
        //    return result;
        //};

        //Ltxml.XEnumerable.prototype.descendantNodes = function () {
        //    var source, result;

        //    source = this.source ? this.source : this;  //ignore jslint
        //    result = source
        //        .selectMany(
        //            function (e) {
        //                if (e.nodeType &&
        //                    (e.nodeType === 'Element' ||
        //                        e.nodeType === 'Comment' ||
        //                        e.nodeType === 'ProcessingInstruction' ||
        //                        e.nodeType === 'Text' ||
        //                        e.nodeType === 'CDATA' ||
        //                        e.nodeType === 'Entity')) {
        //                    return e.descendantNodes();
        //                }
        //                return Enumerable.empty();
        //            })
        //        .asXEnumerable();
        //    return result;
        //};

        //Ltxml.XEnumerable.prototype.descendantNodesAndSelf = function () {
        //    var source, result;

        //    source = this.source ? this.source : this; //ignore jslint
        //    result = source
        //        .selectMany(
        //            function (e) {
        //                if (e.nodeType &&
        //                    (e.nodeType === 'Element' ||
        //                        e.nodeType === 'Comment' ||
        //                        e.nodeType === 'ProcessingInstruction' ||
        //                        e.nodeType === 'Text' ||
        //                        e.nodeType === 'CDATA' ||
        //                        e.nodeType === 'Entity')) {
        //                    return e.descendantNodesAndSelf();
        //                }
        //                return Enumerable.empty();
        //            })
        //        .asXEnumerable();
        //    return result;
        //};

        //Ltxml.XEnumerable.prototype.descendants = function (xname) {
        //    var source, result;

        //    if (xname && typeof xname === 'string') {
        //        xname = new Ltxml.XName(xname);
        //    }
        //    source = this.source ? this.source : this;  //ignore jslint
        //    result = source
        //        .selectMany(
        //            function (e) {
        //                if (e.nodeType && e.nodeType === 'Element') {
        //                    return e.descendants(xname);
        //                }
        //                return Enumerable.empty();
        //            })
        //        .asXEnumerable();
        //    return result;
        //};

        //Ltxml.XEnumerable.prototype.descendantsAndSelf = function (xname) {
        //    var source, result;

        //    if (xname && typeof xname === 'string') {
        //        xname = new Ltxml.XName(xname);
        //    }
        //    source = this.source ? this.source : this;  //ignore jslint
        //    result = source
        //        .selectMany(
        //            function (e) {
        //                if (e.nodeType && e.nodeType === 'Element') {
        //                    return e.descendantsAndSelf(xname);
        //                }
        //                return Enumerable.empty();
        //            })
        //        .asXEnumerable();
        //    return result;
        //};

        //Ltxml.XEnumerable.prototype.elements = function (xname) {
        //    var source, result;

        //    if (xname && typeof xname === 'string') {
        //        xname = new Ltxml.XName(xname);
        //    }
        //    source = this.source ? this.source : this;  //ignore jslint
        //    result = source
        //        .selectMany(
        //            function (e) {
        //                if (e.nodeType &&
        //                    (e.nodeType === 'Element' || e.nodeType === 'Document')) {
        //                    return e.elements(xname);
        //                }
        //                return Enumerable.empty();
        //            })
        //        .asXEnumerable();
        //    return result;
        //};

        //Ltxml.XEnumerable.prototype.InDocumentOrder = function () {
        //    throw "Not implemented";
        //};

        //Ltxml.XEnumerable.prototype.nodes = function () {
        //    var source, result;

        //    source = this.source ? this.source : this;  //ignore jslint
        //    result = source
        //        .selectMany(
        //            function (e) {
        //                if (e.nodeType &&
        //                    (e.nodeType === 'Element' ||
        //                        e.nodeType === 'Document')) {
        //                    return e.nodes();
        //                }
        //                return Enumerable.empty();
        //            })
        //        .asXEnumerable();
        //    return result;
        //};

        //Ltxml.XEnumerable.prototype.remove = function (xname) {
        //    var source, toRemove, i;

        //    if (xname && typeof xname === 'string') {
        //        xname = new Ltxml.XName(xname);
        //    }
        //    source = this.source ? this.source : this;  //ignore jslint
        //    toRemove = source.toArray();
        //    for (i = 0; i < toRemove.length; i += 1) {
        //        if (xname === undefined) {
        //            toRemove[i].remove();
        //        }
        //        else {
        //            if (toRemove[i].name && toRemove[i].name === xname) {
        //                toRemove[i].remove();
        //            }
        //        }
        //    }
        //};

        return Ltxml;
    }
    
    // module export
    if (typeof define === typeof function () { } && define.amd) { // AMD
        define("ltxml", ["linq"], function (Enumerable) {
            Ltxml = defineLtxml(root, Enumerable);
            return Ltxml;
        });
    }
    else if (typeof module !== typeof undefined && module.exports) { // Node
        Ltxml = defineLtxml(root, Enumerable);
        module.exports = Ltxml;
    }
    else {
        // Enumerable must be defined before including ltxml.js.
        Ltxml = defineLtxml(root, Enumerable);
        root.Ltxml = Ltxml;
    }

}(this));/*!
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net
 */
/// <reference path="Copy.ts" /> 
// Copyright 2013 Basarat Ali Syed. All Rights Reserved.
//
// Licensed under MIT open source license http://opensource.org/licenses/MIT
//
// Orginal javascript code was by Mauricio Santos
var Matrix;
(function (Matrix) {
    var Collections;
    (function (Collections) {
        var Queue = (function () {
            /**
             * Creates an empty queue.
             * @class A queue is a First-In-First-Out (FIFO) data structure, the first
             * element added to the queue will be the first one to be removed. This
             * implementation uses a linked list as a container.
             * @constructor
             */
            function Queue() {
                this.list = new Collections.LinkedList();
            }
            /**
             * Inserts the specified element into the end of this queue.
             * @param {Object} elem the element to insert.
             * @return {boolean} true if the element was inserted, or false if it is undefined.
             */
            Queue.prototype.enqueue = function (elem) {
                return this.list.add(elem);
            };
            /**
             * Inserts the specified element into the end of this queue.
             * @param {Object} elem the element to insert.
             * @return {boolean} true if the element was inserted, or false if it is undefined.
             */
            Queue.prototype.add = function (elem) {
                return this.list.add(elem);
            };
            /**
             * Retrieves and removes the head of this queue.
             * @return {*} the head of this queue, or undefined if this queue is empty.
             */
            Queue.prototype.dequeue = function () {
                if (this.list.size() !== 0) {
                    var el = this.list.first();
                    this.list.removeElementAtIndex(0);
                    return el;
                }
                return undefined;
            };
            /**
             * Retrieves, but does not remove, the head of this queue.
             * @return {*} the head of this queue, or undefined if this queue is empty.
             */
            Queue.prototype.peek = function () {
                if (this.list.size() !== 0) {
                    return this.list.first();
                }
                return undefined;
            };
            /**
             * Returns the number of elements in this queue.
             * @return {number} the number of elements in this queue.
             */
            Queue.prototype.size = function () {
                return this.list.size();
            };
            /**
             * Returns true if this queue contains the specified element.
             * <p>If the elements inside this stack are
             * not comparable with the === operator, a custom equals function should be
             * provided to perform searches, the function must receive two arguments and
             * return true if they are equal, false otherwise. Example:</p>
             *
             * <pre>
             * var petsAreEqualByName (pet1, pet2) {
             *  return pet1.name === pet2.name;
             * }
             * </pre>
             * @param {Object} elem element to search for.
             * @param {function(Object,Object):boolean=} equalsFunction optional
             * function to check if two elements are equal.
             * @return {boolean} true if this queue contains the specified element,
             * false otherwise.
             */
            Queue.prototype.contains = function (elem, equalsFunction) {
                return this.list.contains(elem, equalsFunction);
            };
            /**
             * Checks if this queue is empty.
             * @return {boolean} true if and only if this queue contains no items; false
             * otherwise.
             */
            Queue.prototype.isEmpty = function () {
                return this.list.size() <= 0;
            };
            /**
             * Removes all of the elements from this queue.
             */
            Queue.prototype.clear = function () {
                this.list.clear();
            };
            /**
             * Executes the provided function once for each element present in this queue in
             * FIFO order.
             * @param {function(Object):*} callback function to execute, it is
             * invoked with one argument: the element value, to break the iteration you can
             * optionally return false.
             */
            Queue.prototype.forEach = function (callback) {
                this.list.forEach(callback);
            };
            return Queue;
        })();
        Collections.Queue = Queue; // End of queue
    })(Collections = Matrix.Collections || (Matrix.Collections = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Util;
    (function (Util) {
        var Functions;
        (function (Functions) {
            /**
             * Checks if the given argument is a function.
             * @function
             */
            function isFunction(func) {
                return (typeof func) === 'function';
            }
            Functions.isFunction = isFunction;
            /**
             * Checks if the given argument is undefined.
             * @function
             */
            function isUndefined(obj) {
                return (typeof obj) === 'undefined';
            }
            Functions.isUndefined = isUndefined;
            /**
             * Checks if the given argument is a string.
             * @function
             */
            function isString(obj) {
                return Object.prototype.toString.call(obj) === '[object String]';
            }
            Functions.isString = isString;
            function textFormat(source) {
                var args = [];
                for (var _i = 1; _i < arguments.length; _i++) {
                    args[_i - 1] = arguments[_i];
                }
                for (var i = 0; i < args.length; i++)
                    source = source.replace("{" + i + "}", args[i]);
                return source;
            }
            Functions.textFormat = textFormat;
            function hexToString(byteArray) {
                var str = '';
                byteArray.forEach(function (b) {
                    var hex = (b.toString(16));
                    str += (hex.length < 2 ? '0' + hex : hex);
                });
                return str;
            }
            Functions.hexToString = hexToString;
        })(Functions = Util.Functions || (Util.Functions = {}));
    })(Util = Matrix.Util || (Matrix.Util = {}));
})(Matrix || (Matrix = {}));
/// <reference path="../util/functions.ts" />
// Copyright 2013 Basarat Ali Syed. All Rights Reserved.
//
// Licensed under MIT open source license http://opensource.org/licenses/MIT
//
// Orginal javascript code was by Mauricio Santos
/**
 * @namespace Top level namespace for collections, a TypeScript data structure library.
 */
var Matrix;
(function (Matrix) {
    var Collections;
    (function (Collections) {
        var _hasOwnProperty = Object.prototype.hasOwnProperty;
        var has = function (obj, prop) {
            return _hasOwnProperty.call(obj, prop);
        };
        /**
         * Default function to compare element order.
         * @function
         */
        function defaultCompare(a, b) {
            if (a < b) {
                return -1;
            }
            else if (a === b) {
                return 0;
            }
            else {
                return 1;
            }
        }
        Collections.defaultCompare = defaultCompare;
        /**
         * Default function to test equality.
         * @function
         */
        function defaultEquals(a, b) {
            return a === b;
        }
        Collections.defaultEquals = defaultEquals;
        /**
         * Default function to convert an object to a string.
         * @function
         */
        function defaultToString(item) {
            if (item === null) {
                return 'COLLECTION_NULL';
            }
            else if (Matrix.Util.Functions.isUndefined(item)) {
                return 'COLLECTION_UNDEFINED';
            }
            else if (Matrix.Util.Functions.isString(item)) {
                return '$s' + item;
            }
            else {
                return '$o' + item.toString();
            }
        }
        Collections.defaultToString = defaultToString;
        /**
        * Joins all the properies of the object using the provided join string
        */
        function makeString(item, join) {
            if (join === void 0) { join = ","; }
            if (item === null) {
                return 'COLLECTION_NULL';
            }
            else if (Matrix.Util.Functions.isUndefined(item)) {
                return 'COLLECTION_UNDEFINED';
            }
            else if (Matrix.Util.Functions.isString(item)) {
                return item.toString();
            }
            else {
                var toret = "{";
                var first = true;
                for (var prop in item) {
                    if (has(item, prop)) {
                        if (first)
                            first = false;
                        else
                            toret = toret + join;
                        toret = toret + prop + ":" + item[prop];
                    }
                }
                return toret + "}";
            }
        }
        Collections.makeString = makeString;
        /**
         * Reverses a compare function.
         * @function
         */
        function reverseCompareFunction(compareFunction) {
            if (!Matrix.Util.Functions.isFunction(compareFunction)) {
                return function (a, b) {
                    if (a < b) {
                        return 1;
                    }
                    else if (a === b) {
                        return 0;
                    }
                    else {
                        return -1;
                    }
                };
            }
            else {
                return function (d, v) {
                    return compareFunction(d, v) * -1;
                };
            }
        }
        Collections.reverseCompareFunction = reverseCompareFunction;
        /**
         * Returns an equal function given a compare function.
         * @function
         */
        function compareToEquals(compareFunction) {
            return function (a, b) {
                return compareFunction(a, b) === 0;
            };
        }
        Collections.compareToEquals = compareToEquals;
        var LinkedList = (function () {
            /**
            * Creates an empty Linked List.
            * @class A linked list is a data structure consisting of a group of nodes
            * which together represent a sequence.
            * @constructor
            */
            function LinkedList() {
                /**
                * First node in the list
                * @type {Object}
                * @private
                */
                this.firstNode = null;
                /**
                * Last node in the list
                * @type {Object}
                * @private
                */
                this.lastNode = null;
                /**
                * Number of elements in the list
                * @type {number}
                * @private
                */
                this.nElements = 0;
            }
            /**
            * Adds an element to this list.
            * @param {Object} item element to be added.
            * @param {number=} index optional index to add the element. If no index is specified
            * the element is added to the end of this list.
            * @return {boolean} true if the element was added or false if the index is invalid
            * or if the element is undefined.
            */
            LinkedList.prototype.add = function (item, index) {
                if (Matrix.Util.Functions.isUndefined(index)) {
                    index = this.nElements;
                }
                if (index < 0 || index > this.nElements || Matrix.Util.Functions.isUndefined(item)) {
                    return false;
                }
                var newNode = this.createNode(item);
                if (this.nElements === 0) {
                    // First node in the list.
                    this.firstNode = newNode;
                    this.lastNode = newNode;
                }
                else if (index === this.nElements) {
                    // Insert at the end.
                    this.lastNode.next = newNode;
                    this.lastNode = newNode;
                }
                else if (index === 0) {
                    // Change first node.
                    newNode.next = this.firstNode;
                    this.firstNode = newNode;
                }
                else {
                    var prev = this.nodeAtIndex(index - 1);
                    newNode.next = prev.next;
                    prev.next = newNode;
                }
                this.nElements++;
                return true;
            };
            /**
            * Returns the first element in this list.
            * @return {*} the first element of the list or undefined if the list is
            * empty.
            */
            LinkedList.prototype.first = function () {
                if (this.firstNode !== null) {
                    return this.firstNode.element;
                }
                return undefined;
            };
            /**
            * Returns the last element in this list.
            * @return {*} the last element in the list or undefined if the list is
            * empty.
            */
            LinkedList.prototype.last = function () {
                if (this.lastNode !== null) {
                    return this.lastNode.element;
                }
                return undefined;
            };
            /**
             * Returns the element at the specified position in this list.
             * @param {number} index desired index.
             * @return {*} the element at the given index or undefined if the index is
             * out of bounds.
             */
            LinkedList.prototype.elementAtIndex = function (index) {
                var node = this.nodeAtIndex(index);
                if (node === null) {
                    return undefined;
                }
                return node.element;
            };
            /**
             * Returns the index in this list of the first occurrence of the
             * specified element, or -1 if the List does not contain this element.
             * <p>If the elements inside this list are
             * not comparable with the === operator a custom equals function should be
             * provided to perform searches, the function must receive two arguments and
             * return true if they are equal, false otherwise. Example:</p>
             *
             * <pre>
             * var petsAreEqualByName = function(pet1, pet2) {
             *  return pet1.name === pet2.name;
             * }
             * </pre>
             * @param {Object} item element to search for.
             * @param {function(Object,Object):boolean=} equalsFunction Optional
             * function used to check if two elements are equal.
             * @return {number} the index in this list of the first occurrence
             * of the specified element, or -1 if this list does not contain the
             * element.
             */
            LinkedList.prototype.indexOf = function (item, equalsFunction) {
                var equalsF = equalsFunction || Matrix.Collections.defaultEquals;
                if (Matrix.Util.Functions.isUndefined(item)) {
                    return -1;
                }
                var currentNode = this.firstNode;
                var index = 0;
                while (currentNode !== null) {
                    if (equalsF(currentNode.element, item)) {
                        return index;
                    }
                    index++;
                    currentNode = currentNode.next;
                }
                return -1;
            };
            /**
               * Returns true if this list contains the specified element.
               * <p>If the elements inside the list are
               * not comparable with the === operator a custom equals function should be
               * provided to perform searches, the function must receive two arguments and
               * return true if they are equal, false otherwise. Example:</p>
               *
               * <pre>
               * var petsAreEqualByName = function(pet1, pet2) {
               *  return pet1.name === pet2.name;
               * }
               * </pre>
               * @param {Object} item element to search for.
               * @param {function(Object,Object):boolean=} equalsFunction Optional
               * function used to check if two elements are equal.
               * @return {boolean} true if this list contains the specified element, false
               * otherwise.
               */
            LinkedList.prototype.contains = function (item, equalsFunction) {
                return (this.indexOf(item, equalsFunction) >= 0);
            };
            /**
             * Removes the first occurrence of the specified element in this list.
             * <p>If the elements inside the list are
             * not comparable with the === operator a custom equals function should be
             * provided to perform searches, the function must receive two arguments and
             * return true if they are equal, false otherwise. Example:</p>
             *
             * <pre>
             * var petsAreEqualByName = function(pet1, pet2) {
             *  return pet1.name === pet2.name;
             * }
             * </pre>
             * @param {Object} item element to be removed from this list, if present.
             * @return {boolean} true if the list contained the specified element.
             */
            LinkedList.prototype.remove = function (item, equalsFunction) {
                var equalsF = equalsFunction || Matrix.Collections.defaultEquals;
                if (this.nElements < 1 || Matrix.Util.Functions.isUndefined(item)) {
                    return false;
                }
                var previous = null;
                var currentNode = this.firstNode;
                while (currentNode !== null) {
                    if (equalsF(currentNode.element, item)) {
                        if (currentNode === this.firstNode) {
                            this.firstNode = this.firstNode.next;
                            if (currentNode === this.lastNode) {
                                this.lastNode = null;
                            }
                        }
                        else if (currentNode === this.lastNode) {
                            this.lastNode = previous;
                            previous.next = currentNode.next;
                            currentNode.next = null;
                        }
                        else {
                            previous.next = currentNode.next;
                            currentNode.next = null;
                        }
                        this.nElements--;
                        return true;
                    }
                    previous = currentNode;
                    currentNode = currentNode.next;
                }
                return false;
            };
            /**
             * Removes all of the elements from this list.
             */
            LinkedList.prototype.clear = function () {
                this.firstNode = null;
                this.lastNode = null;
                this.nElements = 0;
            };
            /**
             * Returns true if this list is equal to the given list.
             * Two lists are equal if they have the same elements in the same order.
             * @param {LinkedList} other the other list.
             * @param {function(Object,Object):boolean=} equalsFunction optional
             * function used to check if two elements are equal. If the elements in the lists
             * are custom objects you should provide a function, otherwise
             * the === operator is used to check equality between elements.
             * @return {boolean} true if this list is equal to the given list.
             */
            LinkedList.prototype.equals = function (other, equalsFunction) {
                var eqF = equalsFunction || Matrix.Collections.defaultEquals;
                if (!(other instanceof Matrix.Collections.LinkedList)) {
                    return false;
                }
                if (this.size() !== other.size()) {
                    return false;
                }
                return this.equalsAux(this.firstNode, other.firstNode, eqF);
            };
            /**
            * @private
            */
            LinkedList.prototype.equalsAux = function (n1, n2, eqF) {
                while (n1 !== null) {
                    if (!eqF(n1.element, n2.element)) {
                        return false;
                    }
                    n1 = n1.next;
                    n2 = n2.next;
                }
                return true;
            };
            /**
             * Removes the element at the specified position in this list.
             * @param {number} index given index.
             * @return {*} removed element or undefined if the index is out of bounds.
             */
            LinkedList.prototype.removeElementAtIndex = function (index) {
                if (index < 0 || index >= this.nElements) {
                    return undefined;
                }
                var element;
                if (this.nElements === 1) {
                    //First node in the list.
                    element = this.firstNode.element;
                    this.firstNode = null;
                    this.lastNode = null;
                }
                else {
                    var previous = this.nodeAtIndex(index - 1);
                    if (previous === null) {
                        element = this.firstNode.element;
                        this.firstNode = this.firstNode.next;
                    }
                    else if (previous.next === this.lastNode) {
                        element = this.lastNode.element;
                        this.lastNode = previous;
                    }
                    if (previous !== null) {
                        element = previous.next.element;
                        previous.next = previous.next.next;
                    }
                }
                this.nElements--;
                return element;
            };
            /**
             * Executes the provided function once for each element present in this list in order.
             * @param {function(Object):*} callback function to execute, it is
             * invoked with one argument: the element value, to break the iteration you can
             * optionally return false.
             */
            LinkedList.prototype.forEach = function (callback) {
                var currentNode = this.firstNode;
                while (currentNode !== null) {
                    if (callback(currentNode.element) === false) {
                        break;
                    }
                    currentNode = currentNode.next;
                }
            };
            /**
             * Reverses the order of the elements in this linked list (makes the last
             * element first, and the first element last).
             */
            LinkedList.prototype.reverse = function () {
                var previous = null;
                var current = this.firstNode;
                var temp = null;
                while (current !== null) {
                    temp = current.next;
                    current.next = previous;
                    previous = current;
                    current = temp;
                }
                temp = this.firstNode;
                this.firstNode = this.lastNode;
                this.lastNode = temp;
            };
            /**
             * Returns an array containing all of the elements in this list in proper
             * sequence.
             * @return {Array.<*>} an array containing all of the elements in this list,
             * in proper sequence.
             */
            LinkedList.prototype.toArray = function () {
                var array = [];
                var currentNode = this.firstNode;
                while (currentNode !== null) {
                    array.push(currentNode.element);
                    currentNode = currentNode.next;
                }
                return array;
            };
            /**
             * Returns the number of elements in this list.
             * @return {number} the number of elements in this list.
             */
            LinkedList.prototype.size = function () {
                return this.nElements;
            };
            /**
             * Returns true if this list contains no elements.
             * @return {boolean} true if this list contains no elements.
             */
            LinkedList.prototype.isEmpty = function () {
                return this.nElements <= 0;
            };
            //toString(): string {
            //    return Matrix.Collections.arrays.toString(this.toArray());
            //}
            /**
             * @private
             */
            LinkedList.prototype.nodeAtIndex = function (index) {
                if (index < 0 || index >= this.nElements) {
                    return null;
                }
                if (index === (this.nElements - 1)) {
                    return this.lastNode;
                }
                var node = this.firstNode;
                for (var i = 0; i < index; i++) {
                    node = node.next;
                }
                return node;
            };
            /**
             * @private
             */
            LinkedList.prototype.createNode = function (item) {
                return {
                    element: item,
                    next: null
                };
            };
            return LinkedList;
        })();
        Collections.LinkedList = LinkedList; // End of linked list 
        var Dictionary = (function () {
            /**
             * Creates an empty dictionary.
             * @class <p>Dictionaries map keys to values; each key can map to at most one value.
             * This implementation accepts any kind of objects as keys.</p>
             *
             * <p>If the keys are custom objects a function which converts keys to unique
             * strings must be provided. Example:</p>
             * <pre>
             * function petToString(pet) {
             *  return pet.name;
             * }
             * </pre>
             * @constructor
             * @param {function(Object):string=} toStrFunction optional function used
             * to convert keys to strings. If the keys aren't strings or if toString()
             * is not appropriate, a custom function which receives a key and returns a
             * unique string must be provided.
             */
            function Dictionary(toStrFunction) {
                this.table = {};
                this.nElements = 0;
                this.toStr = toStrFunction || Matrix.Collections.defaultToString;
            }
            /**
             * Returns the value to which this dictionary maps the specified key.
             * Returns undefined if this dictionary contains no mapping for this key.
             * @param {Object} key key whose associated value is to be returned.
             * @return {*} the value to which this dictionary maps the specified key or
             * undefined if the map contains no mapping for this key.
             */
            Dictionary.prototype.getValue = function (key) {
                var pair = this.table['$' + this.toStr(key)];
                if (Matrix.Util.Functions.isUndefined(pair)) {
                    return undefined;
                }
                return pair.value;
            };
            /**
             * Associates the specified value with the specified key in this dictionary.
             * If the dictionary previously contained a mapping for this key, the old
             * value is replaced by the specified value.
             * @param {Object} key key with which the specified value is to be
             * associated.
             * @param {Object} value value to be associated with the specified key.
             * @return {*} previous value associated with the specified key, or undefined if
             * there was no mapping for the key or if the key/value are undefined.
             */
            Dictionary.prototype.setValue = function (key, value) {
                if (Matrix.Util.Functions.isUndefined(key) || Matrix.Util.Functions.isUndefined(value)) {
                    return undefined;
                }
                var ret;
                var k = '$' + this.toStr(key);
                var previousElement = this.table[k];
                if (Matrix.Util.Functions.isUndefined(previousElement)) {
                    this.nElements++;
                    ret = undefined;
                }
                else {
                    ret = previousElement.value;
                }
                this.table[k] = {
                    key: key,
                    value: value
                };
                return ret;
            };
            /**
             * Removes the mapping for this key from this dictionary if it is present.
             * @param {Object} key key whose mapping is to be removed from the
             * dictionary.
             * @return {*} previous value associated with specified key, or undefined if
             * there was no mapping for key.
             */
            Dictionary.prototype.remove = function (key) {
                var k = '$' + this.toStr(key);
                var previousElement = this.table[k];
                if (!Matrix.Util.Functions.isUndefined(previousElement)) {
                    delete this.table[k];
                    this.nElements--;
                    return previousElement.value;
                }
                return undefined;
            };
            /**
             * Returns an array containing all of the keys in this dictionary.
             * @return {Array} an array containing all of the keys in this dictionary.
             */
            Dictionary.prototype.keys = function () {
                var array = [];
                for (var name in this.table) {
                    if (has(this.table, name)) {
                        var pair = this.table[name];
                        array.push(pair.key);
                    }
                }
                return array;
            };
            /**
             * Returns an array containing all of the values in this dictionary.
             * @return {Array} an array containing all of the values in this dictionary.
             */
            Dictionary.prototype.values = function () {
                var array = [];
                for (var name in this.table) {
                    if (has(this.table, name)) {
                        var pair = this.table[name];
                        array.push(pair.value);
                    }
                }
                return array;
            };
            /**
            * Executes the provided function once for each key-value pair
            * present in this dictionary.
            * @param {function(Object,Object):*} callback function to execute, it is
            * invoked with two arguments: key and value. To break the iteration you can
            * optionally return false.
            */
            Dictionary.prototype.forEach = function (callback) {
                for (var name in this.table) {
                    if (has(this.table, name)) {
                        var pair = this.table[name];
                        var ret = callback(pair.key, pair.value);
                        if (ret === false) {
                            return;
                        }
                    }
                }
            };
            /**
             * Returns true if this dictionary contains a mapping for the specified key.
             * @param {Object} key key whose presence in this dictionary is to be
             * tested.
             * @return {boolean} true if this dictionary contains a mapping for the
             * specified key.
             */
            Dictionary.prototype.containsKey = function (key) {
                return !Matrix.Util.Functions.isUndefined(this.getValue(key));
            };
            /**
            * Removes all mappings from this dictionary.
            * @this {collections.Dictionary}
            */
            Dictionary.prototype.clear = function () {
                this.table = {};
                this.nElements = 0;
            };
            /**
             * Returns the number of keys in this dictionary.
             * @return {number} the number of key-value mappings in this dictionary.
             */
            Dictionary.prototype.size = function () {
                return this.nElements;
            };
            /**
             * Returns true if this dictionary contains no mappings.
             * @return {boolean} true if this dictionary contains no mappings.
             */
            Dictionary.prototype.isEmpty = function () {
                return this.nElements <= 0;
            };
            Dictionary.prototype.toString = function () {
                var toret = "{";
                this.forEach(function (k, v) {
                    toret = toret + "\n\t" + k.toString() + " : " + v.toString();
                });
                return toret + "\n}";
            };
            return Dictionary;
        })();
        Collections.Dictionary = Dictionary; // End of dictionary
    })(Collections = Matrix.Collections || (Matrix.Collections = {}));
})(Matrix || (Matrix = {})); // End of module  
// Copyright 2013 Basarat Ali Syed. All Rights Reserved.
//
// Licensed under MIT open source license http://opensource.org/licenses/MIT
//
// Orginal javascript code was by Mauricio Santos
/// <reference path="collections.ts" />
var Matrix;
(function (Matrix) {
    var Collections;
    (function (Collections) {
        var Stack = (function () {
            /**
             * Creates an empty Stack.
             * @class A Stack is a Last-In-First-Out (LIFO) data structure, the last
             * element added to the stack will be the first one to be removed. This
             * implementation uses a linked list as a container.
             * @constructor
             */
            function Stack() {
                this.list = new Collections.LinkedList();
            }
            /**
             * Pushes an item onto the top of this stack.
             * @param {Object} elem the element to be pushed onto this stack.
             * @return {boolean} true if the element was pushed or false if it is undefined.
             */
            Stack.prototype.push = function (elem) {
                return this.list.add(elem, 0);
            };
            /**
             * Pushes an item onto the top of this stack.
             * @param {Object} elem the element to be pushed onto this stack.
             * @return {boolean} true if the element was pushed or false if it is undefined.
             */
            Stack.prototype.add = function (elem) {
                return this.list.add(elem, 0);
            };
            /**
             * Removes the object at the top of this stack and returns that object.
             * @return {*} the object at the top of this stack or undefined if the
             * stack is empty.
             */
            Stack.prototype.pop = function () {
                return this.list.removeElementAtIndex(0);
            };
            /**
             * Looks at the object at the top of this stack without removing it from the
             * stack.
             * @return {*} the object at the top of this stack or undefined if the
             * stack is empty.
             */
            Stack.prototype.peek = function () {
                return this.list.first();
            };
            /**
             * Returns the number of elements in this stack.
             * @return {number} the number of elements in this stack.
             */
            Stack.prototype.size = function () {
                return this.list.size();
            };
            /**
             * Returns true if this stack contains the specified element.
             * <p>If the elements inside this stack are
             * not comparable with the === operator, a custom equals function should be
             * provided to perform searches, the function must receive two arguments and
             * return true if they are equal, false otherwise. Example:</p>
             *
             * <pre>
             * var petsAreEqualByName (pet1, pet2) {
             *  return pet1.name === pet2.name;
             * }
             * </pre>
             * @param {Object} elem element to search for.
             * @param {function(Object,Object):boolean=} equalsFunction optional
             * function to check if two elements are equal.
             * @return {boolean} true if this stack contains the specified element,
             * false otherwise.
             */
            Stack.prototype.contains = function (elem, equalsFunction) {
                return this.list.contains(elem, equalsFunction);
            };
            /**
             * Checks if this stack is empty.
             * @return {boolean} true if and only if this stack contains no items; false
             * otherwise.
             */
            Stack.prototype.isEmpty = function () {
                return this.list.isEmpty();
            };
            /**
             * Removes all of the elements from this stack.
             */
            Stack.prototype.clear = function () {
                this.list.clear();
            };
            /**
             * Executes the provided function once for each element present in this stack in
             * LIFO order.
             * @param {function(Object):*} callback function to execute, it is
             * invoked with one argument: the element value, to break the iteration you can
             * optionally return false.
             */
            Stack.prototype.forEach = function (callback) {
                this.list.forEach(callback);
            };
            return Stack;
        })();
        Collections.Stack = Stack; // End of stack 
    })(Collections = Matrix.Collections || (Matrix.Collections = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    "use strict";
    var EventArgs = (function () {
        function EventArgs() {
        }
        Object.defineProperty(EventArgs.prototype, "state", {
            get: function () { return this._state; },
            set: function (value) { this._state = value; },
            enumerable: true,
            configurable: true
        });
        return EventArgs;
    })();
    Matrix.EventArgs = EventArgs;
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="util/functions.ts" />
var Matrix;
(function (Matrix) {
    var Functions = Matrix.Util.Functions;
    var Jid = (function () {
        function Jid(jid) {
            this._node = null;
            this._domain = null;
            this._resource = null;
            if (!Functions.isUndefined(jid)) {
                this._node = this.getNodeFromJid(jid);
                this._domain = this.getDomainFromJid(jid);
                this._resource = this.getResourceFromJid(jid);
            }
        }
        Object.defineProperty(Jid.prototype, "node", {
            get: function () { return this._node; },
            set: function (value) { this._node = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Jid.prototype, "domain", {
            get: function () { return this._domain; },
            set: function (value) { this._domain = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Jid.prototype, "resource", {
            get: function () { return this._resource; },
            set: function (value) { this._resource = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Jid.prototype, "bare", {
            get: function () { return this.getBare(); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Jid.prototype, "full", {
            get: function () { return this.getFull(); },
            enumerable: true,
            configurable: true
        });
        Jid.prototype.toString = function () {
            return this.getFull();
        };
        Jid.prototype.getBare = function () {
            var s = "";
            if (this._node != null)
                s = s + this._node;
            if (this._domain != null) {
                if (s.length > 0)
                    s += "@";
                s += this._domain;
            }
            return s;
        };
        Jid.prototype.getFull = function () {
            var s = this.getBare();
            if (this._resource != null && s.length > 0)
                s += "/" + this._resource;
            return s;
        };
        Jid.prototype.getBareJidFromJid = function (jid) {
            return jid ? jid.split("/")[0] : null;
        };
        Jid.prototype.getResourceFromJid = function (jid) {
            var s = jid.split("/");
            if (s.length < 2) {
                return null;
            }
            s.splice(0, 1);
            return s.join('/');
        };
        Jid.prototype.getDomainFromJid = function (jid) {
            var bare = this.getBareJidFromJid(jid);
            if (bare.indexOf("@") < 0) {
                return bare;
            }
            else {
                var parts = bare.split("@");
                parts.splice(0, 1);
                return parts.join('@');
            }
        };
        Jid.prototype.getNodeFromJid = function (jid) {
            if (jid.indexOf("@") < 0) {
                return null;
            }
            return jid.split("@")[0];
        };
        Jid.prototype.clone = function () {
            return new Jid(this.full);
        };
        return Jid;
    })();
    Matrix.Jid = Jid;
})(Matrix || (Matrix = {}));
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="EventArgs.ts" />
/// <reference path="Jid.ts" />
var Matrix;
(function (Matrix) {
    "use strict";
    var JidEventArgs = (function (_super) {
        __extends(JidEventArgs, _super);
        function JidEventArgs(jid) {
            _super.call(this);
            this.jid = jid;
        }
        Object.defineProperty(JidEventArgs.prototype, "jid", {
            get: function () { return this._jid; },
            set: function (value) { this._jid = value; },
            enumerable: true,
            configurable: true
        });
        return JidEventArgs;
    })(Matrix.EventArgs);
    Matrix.JidEventArgs = JidEventArgs;
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../eventargs.ts" />
var Matrix;
(function (Matrix) {
    var Net;
    (function (Net) {
        var WebRequestEventArgs = (function (_super) {
            __extends(WebRequestEventArgs, _super);
            function WebRequestEventArgs(data, tag) {
                _super.call(this);
                this._data = data;
                this._tag = tag;
            }
            Object.defineProperty(WebRequestEventArgs.prototype, "tag", {
                get: function () { return this._tag; },
                set: function (value) { this._tag = value; },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(WebRequestEventArgs.prototype, "data", {
                get: function () { return this._data; },
                set: function (value) { this._data = value; },
                enumerable: true,
                configurable: true
            });
            return WebRequestEventArgs;
        })(Matrix.EventArgs);
        Net.WebRequestEventArgs = WebRequestEventArgs;
    })(Net = Matrix.Net || (Matrix.Net = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Crypt;
    (function (Crypt) {
        "use strict";
        var RandomNumberGenerator = (function () {
            function RandomNumberGenerator() {
            }
            RandomNumberGenerator.create = function () {
                return new RandomNumberGenerator();
            };
            RandomNumberGenerator.prototype.getBytes = function (array) {
                var validChars = "abcdefghijklmnopqrstuvwxyzABCEDFGHIJKLMNOPQRSTUVWXYZ1234567890";
                var low = 0;
                var high = validChars.length;
                var length = array.length;
                for (var i = 0; i < length; i++) {
                    var idx = Math.floor(Math.random() * (high - low) + low);
                    array[i] = validChars.charCodeAt(idx);
                }
            };
            RandomNumberGenerator.prototype.getString = function (length) {
                var low = 0;
                var high = 255;
                var s = "";
                for (var i = 0; i < length; i++) {
                    var idx = Math.floor(Math.random() * (high - low) + low);
                    s += String.fromCharCode(idx);
                }
                return s;
            };
            RandomNumberGenerator.prototype.getNumber = function (min, max) {
                return Math.floor(Math.random() * (max - min)) + min;
            };
            return RandomNumberGenerator;
        })();
        Crypt.RandomNumberGenerator = RandomNumberGenerator;
    })(Crypt = Matrix.Crypt || (Matrix.Crypt = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Util;
    (function (Util) {
        var Enum;
        (function (Enum) {
            "use strict";
            function toString(e, eVal) {
                return e[eVal];
            }
            Enum.toString = toString;
            function parse(e, val) {
                for (var eMember in e) {
                    var eText = toString(e, eMember);
                    if (typeof eText === 'string') {
                        if (eText.toLocaleLowerCase() === val.toLocaleLowerCase())
                            return eMember;
                    }
                }
                return -1;
            }
            Enum.parse = parse;
        })(Enum = Util.Enum || (Util.Enum = {}));
    })(Util = Matrix.Util || (Matrix.Util = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Util;
    (function (Util) {
        var Time;
        (function (Time) {
            "use strict";
            function Iso8601Date(date) {
                /**
                 * Date.parse with progressive enhancement for ISO 8601 <https://github.com/csnover/js-iso8601>
                 * © 2011 Colin Snover <http://zetafleet.com>
                 * Released under MIT license.
                 */
                var numericKeys = [1, 4, 5, 6, 7, 10, 11];
                var timestamp;
                var struct;
                var minutesOffset = 0;
                // ES5 §15.9.4.2 states that the string should attempt to be parsed as a Date Time String Format string
                // before falling back to any implementation-specific date parsing, so that’s what we do, even if native
                // implementations could be faster
                //              1 YYYY                2 MM       3 DD           4 HH    5 mm       6 ss        7 msec        8 Z 9 ±    10 tzHH    11 tzmm
                if ((struct = /^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(date))) {
                    // avoid NaN timestamps caused by “undefined” values being passed to Date.UTC
                    for (var i = 0, k; (k = numericKeys[i]); ++i) {
                        struct[k] = +struct[k] || 0;
                    }
                    // allow undefined days and months
                    struct[2] = (+struct[2] || 1) - 1;
                    struct[3] = +struct[3] || 1;
                    if (struct[8] !== 'Z' && struct[9] !== undefined) {
                        minutesOffset = struct[10] * 60 + struct[11];
                        if (struct[9] === '+') {
                            minutesOffset = 0 - minutesOffset;
                        }
                    }
                    timestamp = Date.UTC(struct[1], struct[2], struct[3], struct[4], struct[5] + minutesOffset, struct[6], struct[7]);
                }
                else {
                    timestamp = Date.parse ? Date.parse(date) : NaN;
                }
                return timestamp;
            }
            Time.Iso8601Date = Iso8601Date;
        })(Time = Util.Time || (Util.Time = {}));
    })(Util = Matrix.Util || (Matrix.Util = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Typings/ltxml.d.ts" />
/// <reference path="../Util/Enum.ts" />
/// <reference path="../Util/Time.ts" />
var Matrix;
(function (Matrix) {
    var Xml;
    (function (Xml) {
        "use strict";
        var XAttribute = Ltxml.XAttribute;
        var XElement = Ltxml.XElement;
        var XNamespace = Ltxml.XNamespace;
        var Enum = Matrix.Util.Enum;
        var XmppXElement = (function (_super) {
            __extends(XmppXElement, _super);
            function XmppXElement(ns, tagname, prefix) {
                _super.call(this, "{" + ns + "}" + tagname);
                if (prefix)
                    this.add(new XAttribute(XNamespace.xmlns + prefix, ns));
            }
            XmppXElement.prototype.toString = function (indent) {
                if (indent === void 0) { indent = false; }
                return _super.prototype.toString.call(this, indent);
            };
            XmppXElement.prototype.startTag = function () {
                var xml = this.toString();
                xml = xml.replace("/>", ">");
                var idx = xml.indexOf(">");
                return xml.substring(0, idx + 1);
            };
            XmppXElement.prototype.endTag = function () {
                var xml = this.toString();
                var spacePos = xml.indexOf(" ");
                return "</" + xml.substr(1, spacePos - 1) + ">";
            };
            XmppXElement.prototype.getAttribute = function (attname) {
                if (this.hasAttribute(attname))
                    return this.attribute(attname).value;
                return null;
            };
            XmppXElement.prototype.hasAttribute = function (attname) {
                var att = this.attribute(attname);
                return (att !== null);
            };
            XmppXElement.prototype.setAttribute = function (attname, val) {
                this.setAttributeValue(attname, val);
                return this;
            };
            XmppXElement.prototype.removeAttribute = function (attname) {
                this.setAttributeValue(attname, null);
                return this;
            };
            XmppXElement.prototype.setAttributeEnum = function (attname, e, eVal) {
                this.setAttributeValue(attname, Enum.toString(e, eVal).toLocaleLowerCase());
                return this;
            };
            XmppXElement.prototype.getAttributeEnum = function (attname, e) {
                if (this.hasAttribute(attname)) {
                    var attValue = this.attribute(attname).value;
                    return Enum.parse(e, attValue);
                }
                return -1;
            };
            XmppXElement.prototype.getAttributeBoolean = function (name) {
                if (this.hasAttribute(name)) {
                    var val = this.getAttribute(name);
                    if (val === "true" || val === "1")
                        return true;
                }
                return false;
            };
            XmppXElement.prototype.setAttributeBoolean = function (name, val) {
                this.setAttribute(name, val ? "true" : "false");
                return this;
            };
            XmppXElement.prototype.getAttributeNumber = function (name) {
                try {
                    if (this.hasAttribute(name)) {
                        var val = this.getAttribute(name);
                        return parseInt(val);
                    }
                    return 0;
                }
                catch (e) {
                    return 0;
                }
            };
            XmppXElement.prototype.setAttributeNumber = function (attname, val) {
                this.setAttribute(attname, val.toString());
                return this;
            };
            XmppXElement.prototype.setAttributeIso8601Date = function (attname, val) {
                var dt = new Date(val);
                this.setAttribute(attname, dt.toISOString());
                return this;
            };
            XmppXElement.prototype.getAttributeIso8601Date = function (attname) {
                return Matrix.Util.Time.Iso8601Date(this.getAttribute(attname));
            };
            XmppXElement.prototype.getAttributeJid = function (attname) {
                if (this.hasAttribute(attname)) {
                    var attValue = this.attribute(attname).value;
                    return new Matrix.Jid(attValue);
                }
                return null;
            };
            XmppXElement.prototype.setAttributeJid = function (attname, jid) {
                this.setAttributeValue(attname, jid.toString());
                return this;
            };
            XmppXElement.prototype.getFirstXmppXElement = function () {
                return this
                    .elements()
                    .firstOrDefault(function (n) { return (n instanceof Matrix.Xml.XmppXElement); });
            };
            Object.defineProperty(XmppXElement.prototype, "firstXmppXElement", {
                get: function () {
                    return this.getFirstXmppXElement();
                },
                enumerable: true,
                configurable: true
            });
            XmppXElement.prototype.elementOfType = function (typee) {
                return this
                    .elements()
                    .firstOrDefault(function (n) { return (n instanceof typee); });
            };
            XmppXElement.prototype.elementsOfType = function (typee) {
                return this
                    .elements()
                    .where(function (n) { return (n instanceof typee); });
            };
            XmppXElement.prototype.getValueFromBase64 = function () {
                return Matrix.Util.Base64.decode(this.value);
            };
            XmppXElement.prototype.setValueFromBase64 = function (value) {
                this.value = Matrix.Util.Base64.encode(value);
            };
            XmppXElement.prototype.getTag = function (tagname) {
                var ns = this.name.namespaceName;
                var child = this.element("{" + ns + "}" + tagname);
                if (child != null)
                    return child.value;
                return null;
            };
            XmppXElement.prototype.hasElementOfType = function (typee) {
                return this.elementOfType(typee) != null;
            };
            XmppXElement.prototype.hasTag = function (tagname) {
                return this.getTag(tagname) != null;
            };
            XmppXElement.prototype.getTagJid = function (tagname) {
                var val = this.getTag(tagname);
                if (val != null)
                    return new Matrix.Jid(val);
                return null;
            };
            XmppXElement.prototype.removeTag = function (tagname) {
                var ns = this.name.namespaceName;
                var el = this.element("{" + ns + "}" + tagname);
                if (el != null)
                    el.remove();
            };
            XmppXElement.prototype.setTag = function (tagname, value) {
                var ns = this.name.namespaceName;
                this.add(new XElement("{" + ns + "}" + tagname, value));
                return this;
            };
            XmppXElement.prototype.replace = function (clazz, value) {
                var el = this.elementOfType(clazz);
                if (el != null)
                    el.remove();
                this.add(value);
            };
            // load using the streamparser and sax.js
            XmppXElement.loadXml = function (xml) {
                var el = null;
                var sp = new Xml.XmppStreamParser();
                sp.onStreamElement.on(function (args) {
                    el = args.stanza;
                });
                sp.write("<a>" + xml + "</a>");
                return el;
            };
            return XmppXElement;
        })(XElement);
        Xml.XmppXElement = XmppXElement;
    })(Xml = Matrix.Xml || (Matrix.Xml = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="EventArgs.ts" />
var Matrix;
(function (Matrix) {
    "use strict";
    var ExceptionEventArgs = (function (_super) {
        __extends(ExceptionEventArgs, _super);
        function ExceptionEventArgs(ex) {
            _super.call(this);
            this._exception = null;
            if (ex)
                this._exception = ex;
        }
        Object.defineProperty(ExceptionEventArgs.prototype, "exception", {
            get: function () { return this._exception; },
            enumerable: true,
            configurable: true
        });
        return ExceptionEventArgs;
    })(Matrix.EventArgs);
    Matrix.ExceptionEventArgs = ExceptionEventArgs;
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="EventArgs.ts" />
var Matrix;
(function (Matrix) {
    var TextEventArgs = (function (_super) {
        __extends(TextEventArgs, _super);
        function TextEventArgs(text) {
            _super.call(this);
            this.text = text;
        }
        Object.defineProperty(TextEventArgs.prototype, "text", {
            get: function () { return this._text; },
            set: function (value) { this._text = value; },
            enumerable: true,
            configurable: true
        });
        return TextEventArgs;
    })(Matrix.EventArgs);
    Matrix.TextEventArgs = TextEventArgs;
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Xml/XmppXElement.ts" />
/// <reference path="../EventArgs.ts" />
/// <reference path="../ExceptionEventArgs.ts" />
/// <reference path="../TextEventArgs.ts" />
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Bosh;
        (function (Bosh) {
            Bosh.conditionMapping = [
                "bad-request",
                "host-gone",
                "host-unknown",
                "improper-addressing",
                "internal-server-error",
                "item-not-found",
                "other-request",
                "policy-violation",
                "remote-connection-failed",
                "remote-stream-error",
                "see-other-uri",
                "system-shutdown",
                "undefined-condition"
            ];
            Object.freeze(Bosh.conditionMapping);
            (function (Condition) {
                Condition[Condition["None"] = -1] = "None";
                /// <summary>
                /// The format of an HTTP header or binding element received from the client is unacceptable (e.g., syntax error).
                /// </summary>
                Condition[Condition["BadRequest"] = 0] = "BadRequest";
                /// <summary>
                /// The target domain specified in the 'to' attribute or the target host or port specified in the 'route' attribute is no longer 
                /// serviced by the connection manager.
                /// </summary>
                Condition[Condition["HostGone"] = 1] = "HostGone";
                /// <summary>
                /// The target domain specified in the 'to' attribute or the target host or port specified in the 'route' attribute is unknown 
                /// to the connection manager.
                /// </summary>
                Condition[Condition["HostUnknown"] = 2] = "HostUnknown";
                /// <summary>
                /// The initialization element lacks a 'to' or 'route' attribute (or the attribute has no value) but the connection manager requires one.
                /// </summary>
                Condition[Condition["ImproperAddressing"] = 3] = "ImproperAddressing";
                /// <summary>
                /// The connection manager has experienced an internal error that prevents it from servicing the request.
                /// </summary>
                Condition[Condition["InternalServerError"] = 4] = "InternalServerError";
                /// <summary>
                /// (1) 'sid' is not valid, 
                /// (2) 'stream' is not valid, 
                /// (3) 'rid' is larger than the upper limit of the expected window, 
                /// (4) connection manager is unable to resend response, 
                /// (5) 'key' sequence is invalid.
                /// </summary>
                Condition[Condition["ItemNotFound"] = 5] = "ItemNotFound";
                /// <summary>
                /// Another request being processed at the same time as this request caused the session to terminate.
                /// </summary>
                Condition[Condition["OtherRequest"] = 6] = "OtherRequest";
                /// <summary>
                /// The client has broken the session rules (polling too frequently, requesting too frequently, sending too many simultaneous requests).
                /// </summary>
                Condition[Condition["PolicyViolation"] = 7] = "PolicyViolation";
                /// <summary>
                /// The connection manager was unable to connect to, or unable to connect securely to, or has lost its connection to, the server.
                /// </summary>
                Condition[Condition["RemoteConnectionFailed"] = 8] = "RemoteConnectionFailed";
                /// <summary>
                /// Encapsulates an error in the protocol being transported.
                /// </summary>
                Condition[Condition["RemoteStreamError"] = 9] = "RemoteStreamError";
                /// <summary>
                /// The connection manager does not operate at this URI (e.g., the connection manager accepts only SSL or TLS connections at some
                /// https: URI rather than the http: URI requested by the client). The client can try POSTing to the URI in the content of the
                /// &lt;uri/&gt; child element.
                /// </summary>
                Condition[Condition["SeeOtherUri"] = 10] = "SeeOtherUri";
                /// <summary>
                /// The connection manager is being shut down. All active HTTP sessions are being terminated. No new sessions can be created.
                /// </summary>
                Condition[Condition["SystemShutdown"] = 11] = "SystemShutdown";
                /// <summary>
                /// The error is not one of those defined herein; the connection manager SHOULD include application-specific information in the
                /// content of the <body/> wrapper.
                /// </summary>
                Condition[Condition["UndefinedCondition"] = 12] = "UndefinedCondition";
            })(Bosh.Condition || (Bosh.Condition = {}));
            var Condition = Bosh.Condition;
            Object.freeze(Condition);
            function conditionToEnum(val) {
                for (var i = 0; i < Bosh.conditionMapping.length; i++) {
                    if (Bosh.conditionMapping[i] === val)
                        return i;
                }
                return Condition.None;
            }
            Bosh.conditionToEnum = conditionToEnum;
            function enumToCondition(cond) {
                if (cond !== -1)
                    return Bosh.conditionMapping[cond];
                return null;
            }
            Bosh.enumToCondition = enumToCondition;
        })(Bosh = Xmpp.Bosh || (Xmpp.Bosh = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Bosh;
        (function (Bosh) {
            (function (Type) {
                Type[Type["None"] = -1] = "None";
                Type[Type["Error"] = 0] = "Error";
                Type[Type["Terminate"] = 1] = "Terminate";
            })(Bosh.Type || (Bosh.Type = {}));
            var Type = Bosh.Type;
            Object.freeze(Type);
        })(Bosh = Xmpp.Bosh || (Xmpp.Bosh = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../Xml/XmppXElement.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Base;
        (function (Base) {
            "use strict";
            var XmppXElement = Matrix.Xml.XmppXElement;
            var XmppXElementWithAddress = (function (_super) {
                __extends(XmppXElementWithAddress, _super);
                function XmppXElementWithAddress(ns, tagname, prefix) {
                    _super.call(this, ns, tagname, prefix);
                }
                Object.defineProperty(XmppXElementWithAddress.prototype, "from", {
                    get: function () {
                        return this.getAttributeJid("from");
                    },
                    set: function (value) {
                        this.setAttributeJid("form", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(XmppXElementWithAddress.prototype, "to", {
                    get: function () {
                        return this.getAttributeJid("to");
                    },
                    set: function (value) {
                        this.setAttributeJid("to", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                /* Switches the from and to attributes when existing*/
                XmppXElementWithAddress.prototype.switchDirection = function () {
                    // store existing bvalues
                    var from = this.from;
                    var to = this.to;
                    // Remove from and to now
                    this.removeAttribute("from");
                    this.removeAttribute("to");
                    // switch the values
                    var helper = from;
                    from = to;
                    to = helper;
                    // set them again
                    this.from = from;
                    this.to = to;
                };
                return XmppXElementWithAddress;
            })(XmppXElement);
            Base.XmppXElementWithAddress = XmppXElementWithAddress;
        })(Base = Xmpp.Base || (Xmpp.Base = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Namespaces;
    (function (Namespaces) {
        Namespaces.stream = "http://etherx.jabber.org/streams";
        Namespaces.client = "jabber:client";
        Namespaces.server = "jabber:server";
        Namespaces.serverDialback = "jabber:server:dialback";
        Namespaces.featureIqRegister = "http://jabber.org/features/iq-register";
        /// <summary>Sasl (urn:ietf:params:xml:ns:xmpp-sasl)</summary>
        Namespaces.sasl = "urn:ietf:params:xml:ns:xmpp-sasl";
        /// <summary>Bind (urn:ietf:params:xml:ns:xmpp-bind)</summary>
        Namespaces.bind = "urn:ietf:params:xml:ns:xmpp-bind";
        /// <summary>Session (urn:ietf:params:xml:ns:xmpp-session)</summary>
        Namespaces.session = "urn:ietf:params:xml:ns:xmpp-session";
        /// <summary>
        /// jabber:iq:roster
        /// </summary>
        Namespaces.iqRoster = "jabber:iq:roster";
        Namespaces.httpBind = "http://jabber.org/protocol/httpbind";
        Namespaces.xmppXBosh = "urn:xmpp:xbosh";
        /* websocket framing urn:ietf:params:xml:ns:xmpp-framing */
        Namespaces.framing = "urn:ietf:params:xml:ns:xmpp-framing";
        /// <summary>XEP-0203: Delayed Delivery (urn:xmpp:delay)</summary>
        Namespaces.delay = "urn:xmpp:delay";
        // Muc
        /// <summary>XEP-0045: Multi User Chat (http://jabber.org/protocol/muc)</summary>
        Namespaces.muc = "http://jabber.org/protocol/muc";
        /// <summary>XEP-0045: Multi User Chat (http://jabber.org/protocol/muc#user)</summary>
        Namespaces.mucUser = "http://jabber.org/protocol/muc#user";
        /// <summary>XEP-0045: Multi User Chat (http://jabber.org/protocol/muc#admin)</summary>
        Namespaces.mucAdmin = "http://jabber.org/protocol/muc#admin";
        /// <summary>XEP-0045: Multi User Chat (http://jabber.org/protocol/muc#owner)</summary>
        Namespaces.mucOwner = "http://jabber.org/protocol/muc#owner";
        /// <summary>(jabber:x:conference)</summary>
        Namespaces.xConference = "jabber:x:conference";
    })(Namespaces = Matrix.Namespaces || (Matrix.Namespaces = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="Condition.ts" />
/// <reference path="Type.ts" />
/// <reference path="../Base/XmppXElementWithAddress.ts" />
/// <reference path="../../Namespaces.ts" />
/// <reference path="../../Jid.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Bosh;
        (function (Bosh) {
            /*
            * <body
            *  rid='1996404094'
            *  xmlns='http://jabber.org/protocol/httpbind'
            *  to='anon.ag-software.net'
            *  xml:lang='en'
            *  wait='60'
            *  hold='1'
            *  content='text/xml; charset=utf-8' ver='1.6'
            *  xmpp:version='1.0'
            *  xmlns:xmpp='urn:xmpp:xbosh'/>
            */
            var XmppXElementWithAddress = Matrix.Xmpp.Base.XmppXElementWithAddress;
            var XNamespace = Ltxml.XNamespace;
            var XAttribute = Ltxml.XAttribute;
            var Body = (function (_super) {
                __extends(Body, _super);
                function Body() {
                    _super.call(this, Matrix.Namespaces.httpBind, "body");
                    this.nsBosh = new XNamespace(Matrix.Namespaces.xmppXBosh);
                }
                Object.defineProperty(Body.prototype, "version", {
                    /// <summary>
                    /// Specifies the highest version of the BOSH protocol that the client supports.
                    /// The numbering scheme is major.minor (where the minor number MAY be incremented higher than a single digit,
                    /// so it MUST be treated as a separate integer).
                    /// </summary>
                    /// <value>The version.</value>
                    /// <remarks>
                    /// The version should not be confused with the version of any protocol being transported.
                    /// </remarks>
                    get: function () {
                        return this.getAttribute("ver");
                    },
                    set: function (value) {
                        this.setAttribute("ver", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Body.prototype, "polling", {
                    get: function () {
                        return this.getAttributeNumber("polling");
                    },
                    set: function (value) {
                        this.setAttributeNumber("polling", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Body.prototype, "rid", {
                    get: function () {
                        return this.getAttributeNumber("rid");
                    },
                    set: function (value) {
                        this.setAttributeNumber("rid", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Body.prototype, "sid", {
                    get: function () {
                        return this.getAttribute("sid");
                    },
                    set: function (value) {
                        this.setAttribute("sid", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Body.prototype, "hold", {
                    get: function () {
                        return this.getAttributeNumber("hold");
                    },
                    set: function (value) {
                        this.setAttributeNumber("hold", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Body.prototype, "wait", {
                    get: function () {
                        return this.getAttributeNumber("wait");
                    },
                    set: function (value) {
                        this.setAttributeNumber("wait", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Body.prototype, "inactivity", {
                    get: function () {
                        return this.getAttributeNumber("inactivity");
                    },
                    set: function (value) {
                        this.setAttributeNumber("inactivity", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Body.prototype, "xmppVersion", {
                    get: function () {
                        return this.getAttribute(this.nsBosh + "version");
                    },
                    set: function (value) {
                        this.setAttribute(this.nsBosh + "version", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Body.prototype, "xmppRestart", {
                    get: function () {
                        return this.getAttributeBoolean(this.nsBosh + "restart");
                    },
                    set: function (value) {
                        this.setAttributeBoolean(this.nsBosh + "restart", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Body.prototype, "type", {
                    get: function () {
                        return this.getAttributeEnum("type", Bosh.Type);
                    },
                    set: function (value) {
                        if (value == Bosh.Type.None)
                            this.removeAttribute("type");
                        else
                            this.setAttributeEnum("type", Bosh.Type, value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Body.prototype, "condition", {
                    get: function () {
                        return Bosh.conditionToEnum(this.getAttribute("condition"));
                    },
                    set: function (value) {
                        if (value == Bosh.Condition.None)
                            this.removeAttribute("condition");
                        else
                            this.setAttribute("condition", Bosh.enumToCondition(value));
                    },
                    enumerable: true,
                    configurable: true
                });
                Body.prototype.addBoshNameSpace = function () {
                    this.add(new XAttribute(XNamespace.xmlns + "xmpp", Matrix.Namespaces.xmppXBosh));
                    return this;
                };
                Body.prototype.addStreamNameSpace = function () {
                    // xmlns:stream='http://etherx.jabber.org/streams'>
                    this.add(new XAttribute(XNamespace.xmlns + "stream", Matrix.Namespaces.stream));
                    return this;
                };
                return Body;
            })(XmppXElementWithAddress);
            Bosh.Body = Body;
        })(Bosh = Xmpp.Bosh || (Xmpp.Bosh = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="IEvent.ts" />
var Matrix;
(function (Matrix) {
    "use strict";
    var GenericEvent = (function () {
        function GenericEvent() {
            this.handlers = [];
        }
        GenericEvent.prototype.on = function (handler) {
            this.handlers.push(handler);
        };
        GenericEvent.prototype.off = function (handler) {
            this.handlers = this.handlers.filter(function (h) { return h !== handler; });
        };
        GenericEvent.prototype.trigger = function (data) {
            if (this.handlers) {
                this.handlers.slice(0).forEach(function (h) { return h(data); });
            }
        };
        return GenericEvent;
    })();
    Matrix.GenericEvent = GenericEvent;
})(Matrix || (Matrix = {}));
/// <reference path="../events.ts" />
/// <reference path="functions.ts" />
var Matrix;
(function (Matrix) {
    var Util;
    (function (Util) {
        var Timer = (function () {
            function Timer(interval) {
                this.onTick = new Matrix.GenericEvent();
                this._interval = 500;
                if (!Util.Functions.isUndefined(interval))
                    this.interval = interval;
            }
            Object.defineProperty(Timer.prototype, "interval", {
                get: function () { return this._interval; },
                set: function (value) { this._interval = value; },
                enumerable: true,
                configurable: true
            });
            Timer.prototype.start = function () {
                var _this = this;
                this._timerToken = setInterval(function () {
                    return _this.onTick.trigger();
                }, this.interval);
            };
            Timer.prototype.stop = function () {
                clearTimeout(this._timerToken);
            };
            return Timer;
        })();
        Util.Timer = Timer;
    })(Util = Matrix.Util || (Matrix.Util = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../util/functions.ts" />
/// <reference path="webrequesteventargs.ts" />
/// <reference path="../crypt/randomnumbergenerator.ts" />
/// <reference path="isocket.ts" />
/// <reference path="../xmpp/bosh/body.ts" />
/// <reference path="../collections/queue.ts" />
/// <reference path="../collections/collections.ts" />
/// <reference path="../util/timer.ts" />
var Matrix;
(function (Matrix) {
    var Net;
    (function (Net) {
        var Body = Matrix.Xmpp.Bosh.Body;
        var XmppXElement = Matrix.Xml.XmppXElement;
        var Queue = Matrix.Collections.Queue;
        var Type = Matrix.Xmpp.Bosh.Type;
        var BoshSocket = (function () {
            function BoshSocket(xmppClient) {
                var _this = this;
                // default values
                this.DEFAULT_WAIT = 120;
                this.DEFAULT_SEND_FUNC_INTERVAL = 250;
                this.DEFAULT_RECONNECT_INTERVALS = [1000, 2000, 5000, 10000];
                this.onReadData = new Matrix.GenericEvent();
                this.onWriteData = new Matrix.GenericEvent();
                this.onConnect = new Matrix.GenericEvent();
                this.onDisconnect = new Matrix.GenericEvent();
                this.onError = new Matrix.GenericEvent();
                this.maxRidToGenerate = 4503599627370496;
                this.maxRidAllowed = 9007199254740991;
                this.BOSH_VERSION = "1.6";
                this.wait = this.DEFAULT_WAIT;
                this.inactivity = 0;
                this.terminate = false;
                this.clientTerminated = false;
                this.serverTerminated = false;
                this.sessionStarted = false;
                this.deadTime = null;
                this.sendQueue = new Queue();
                //#endregion
                this.readDataHandler = function (args) {
                    _this.readDataHandlerFunc(args);
                };
                this.sendDataHandler = function (args) {
                    _this.sendDataHandlerFunc(args);
                };
                this.errorHandler = function (args) {
                    _this.errorHandlerFunc(args);
                };
                this._xmppClient = xmppClient;
            }
            //#region public methods
            BoshSocket.prototype.connect = function () {
                this.requestA = new Net.WebRequest(this._xmppClient.uri, "A");
                this.requestB = new Net.WebRequest(this._xmppClient.uri, "B");
                this.requestA.onReadData.on(this.readDataHandler);
                this.requestB.onReadData.on(this.readDataHandler);
                this.requestA.onSendData.on(this.sendDataHandler);
                this.requestB.onSendData.on(this.sendDataHandler);
                this.requestA.onError.on(this.errorHandler);
                this.requestB.onError.on(this.errorHandler);
                this.rid = this.generateRid();
                this.clientTerminated = false;
                this.sendFuncInterval = this.DEFAULT_SEND_FUNC_INTERVAL;
                this.reconnectIntervalsIndex = -1;
                this.deadTime = null;
                this.getNextHttpWebRequest().execute(this.buildSessionRequestBody().toString());
                this.triggerSendFunction();
            };
            BoshSocket.prototype.disconnect = function () {
                this.terminate = true;
            };
            BoshSocket.prototype.send = function (el) {
                // Bosh should send only XmppXElements
                this.sendQueue.enqueue(el);
            };
            BoshSocket.prototype.readDataHandlerFunc = function (args) {
                // workaround for this problem in lambas
                this.onReadData.trigger(new Matrix.TextEventArgs(args.data));
                var el = XmppXElement.loadXml(args.data);
                if (el instanceof Matrix.Xmpp.Bosh.Body)
                    this.processBody(el);
                if (this.serverTerminated && this.oneBusy)
                    this.onDisconnect.trigger(new Matrix.EventArgs());
            };
            BoshSocket.prototype.sendDataHandlerFunc = function (args) {
                // workaround for this problem in lambas
                this.deadTime = null;
                this.onWriteData.trigger(new Matrix.TextEventArgs(args.data));
            };
            BoshSocket.prototype.errorHandlerFunc = function (args) {
                // workaround for this problem in lambas
                if (!this.sessionStarted) {
                    this.clientTerminated = true;
                    this.onError.trigger(args);
                    return;
                }
                var now = new Date();
                if (this.deadTime == null)
                    this.deadTime = now;
                else {
                    var inactive = (now.getTime() - this.deadTime.getTime()) / 1000;
                    if (inactive > this.inactivity) {
                        this.clientTerminated = true;
                        this.onDisconnect.trigger(new Matrix.EventArgs());
                        return;
                    }
                }
                if (this.reconnectIntervalsIndex < this.DEFAULT_RECONNECT_INTERVALS.length - 1) {
                    this.reconnectIntervalsIndex++;
                    this.sendFuncInterval = this.DEFAULT_RECONNECT_INTERVALS[this.reconnectIntervalsIndex];
                }
            };
            BoshSocket.prototype.processBody = function (body) {
                var _this = this;
                if (!this.sid) {
                    this.sid = body.sid;
                    this.sessionStarted = true;
                }
                if (this.inactivity == 0)
                    this.inactivity = body.inactivity;
                if (body.type == Type.Terminate)
                    this.serverTerminated = true;
                return body
                    .elements()
                    .where(function (n) { return (n instanceof Matrix.Xml.XmppXElement); })
                    .forEach(function (el) { return _this._xmppClient.xmppStreamParser.onStreamElement.trigger(new Matrix.StanzaEventArgs(el)); });
            };
            Object.defineProperty(BoshSocket.prototype, "bothBusy", {
                /* are both requests currently busy? */
                get: function () { return this.countBusy === 2; },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(BoshSocket.prototype, "noneBusy", {
                /* is no request busy right now? */
                get: function () { return this.countBusy === 0; },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(BoshSocket.prototype, "oneBusy", {
                get: function () { return this.countBusy === 1; },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(BoshSocket.prototype, "countBusy", {
                get: function () {
                    var count = 0;
                    if (this.requestA.isBusy)
                        count++;
                    if (this.requestB.isBusy)
                        count++;
                    return count;
                },
                enumerable: true,
                configurable: true
            });
            BoshSocket.prototype.getNextHttpWebRequest = function () {
                if (!this.requestA.isBusy)
                    return this.requestA;
                if (!this.requestB.isBusy)
                    return this.requestB;
                return null;
            };
            //* generates the rid for this session *//
            BoshSocket.prototype.generateRid = function () {
                return Matrix.Crypt.RandomNumberGenerator.create().getNumber(1, this.maxRidToGenerate);
            };
            BoshSocket.prototype.buildSessionRequestBody = function () {
                var body = new Body();
                /*
                 * <body hold='1' xmlns='http://jabber.org/protocol/httpbind'
                 *  to='vm-2k'
                 *  wait='300'
                 *  rid='782052'
                 *  newkey='8e7d6cec12004e2bfcf7fc000310fda87bc8337c'
                 *  ver='1.6'
                 *  xmpp:xmlns='urn:xmpp:xbosh'
                 *  xmpp:version='1.0'/>
                 */
                body.addBoshNameSpace();
                body.addStreamNameSpace();
                body.version = this.BOSH_VERSION;
                //body.xmppVersion = "1.0";
                //body.hold = hold; // do we need that?
                body.wait = this.wait;
                body.rid = this.rid;
                body.polling = 0;
                body.to = new Matrix.Jid(this._xmppClient.xmppDomain);
                return body;
            };
            BoshSocket.prototype.buildBody = function () {
                this.rid++;
                var body = new Body();
                body.addBoshNameSpace();
                body.addStreamNameSpace();
                body.rid = this.rid;
                body.sid = this.sid;
                body.to = new Matrix.Jid(this._xmppClient.xmppDomain);
                if (this.terminate === true) {
                    body.type = Type.Terminate;
                    this.clientTerminated = true;
                }
                if (this.sendQueue.size() > 0) {
                    while (this.sendQueue.size() > 0) {
                        var qel = this.sendQueue.dequeue();
                        if (qel instanceof Matrix.Xmpp.Client.Stream)
                            body.xmppRestart = true;
                        else
                            body.add(qel);
                    }
                }
                return body;
            };
            /* calcel all WebRequests */
            BoshSocket.prototype.cancelRequests = function () {
                this.requestA.cancel();
                this.requestA.cancel();
            };
            //#region send loop
            BoshSocket.prototype.sendFunction = function () {
                if (this.clientTerminated) {
                    console.log("stop sendFunction");
                    return;
                }
                if (this.sendQueue.size() > 0 && !this.bothBusy) {
                    console.log("queue: " + this.sendQueue.size() + " have free request, terminate: " + this.terminate);
                    this.getNextHttpWebRequest().execute(this.buildBody().toString());
                }
                else if (this.sendQueue.size() == 0 && this.noneBusy && !this.terminate) {
                    console.log("queue: " + this.sendQueue.size() + " no active requests, terminate: " + this.terminate);
                    this.getNextHttpWebRequest().execute(this.buildBody().toString());
                }
                else if (this.terminate && !this.bothBusy) {
                    console.log("queue: " + this.sendQueue.size() + " have free request, terminate: " + this.terminate);
                    this.getNextHttpWebRequest().execute(this.buildBody().toString());
                }
                this.triggerSendFunction();
            };
            BoshSocket.prototype.triggerSendFunction = function () {
                var _this = this;
                setTimeout(function () {
                    _this.sendFunction();
                }, this.sendFuncInterval);
            };
            return BoshSocket;
        })();
        Net.BoshSocket = BoshSocket;
    })(Net = Matrix.Net || (Matrix.Net = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="webrequesteventargs.ts" />
var Matrix;
(function (Matrix) {
    var Net;
    (function (Net) {
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
        var WebRequest = (function () {
            function WebRequest(url, tag) {
                this.webRequest = null;
                this.isBusy = false;
                this.onReadData = new Matrix.GenericEvent();
                this.onSendData = new Matrix.GenericEvent();
                this.onError = new Matrix.GenericEvent();
                this.url = url;
                this.tag = tag;
                this.create();
            }
            WebRequest.prototype.create = function () {
                if (XMLHttpRequest) {
                    this.webRequest = new XMLHttpRequest();
                    if (this.webRequest.overrideMimeType) {
                        this.webRequest.overrideMimeType("text/xml; charset=utf-8");
                    }
                }
                else if (ActiveXObject) {
                    this.webRequest = new ActiveXObject("Microsoft.XMLHTTP");
                }
                this.webRequest.onreadystatechange = this.requestOnreadyStateChange(this);
            };
            WebRequest.prototype.requestOnreadyStateChange = function (webRequest) {
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
                return function () {
                    //console.log("ready state " + this.readyState);
                    if (this.readyState == 4) {
                        var reqStatus = 0;
                        try {
                            reqStatus = this.status;
                        }
                        catch (e) {
                        }
                        if (this.status == 200) {
                            // All right - data is stored in xhr.responseText
                            //alert(this.responseText);
                            webRequest.onSendData.trigger(new Net.WebRequestEventArgs(webRequest.data, webRequest.tag));
                            webRequest.onReadData.trigger(new Net.WebRequestEventArgs(this.responseText, webRequest.tag));
                        }
                        else {
                            webRequest.onError.trigger(new Matrix.ExceptionEventArgs("webrequest Error"));
                        }
                        webRequest.isBusy = false;
                    }
                };
            };
            WebRequest.prototype.execute = function (data) {
                this.data = data;
                this.isBusy = true;
                this.webRequest.open("POST", this.url, true);
                this.webRequest.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
                this.webRequest.send(data);
            };
            /* cancel the webrequest */
            WebRequest.prototype.cancel = function () {
                // abort requets and assign empty function for callback
                this.webRequest.abort();
                this.webRequest.onreadystatechange = function () { };
            };
            return WebRequest;
        })();
        Net.WebRequest = WebRequest;
    })(Net = Matrix.Net || (Matrix.Net = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Sasl;
    (function (Sasl) {
        "use strict";
        // array for mapping to the enum
        Sasl.saslMechanismMapping = [
            "PLAIN",
            "DIGEST-MD5",
            "SCRAM-SHA-1",
            "ANONYMOUS"
        ];
        Object.freeze(Sasl.saslMechanismMapping);
        (function (SaslMechanism) {
            SaslMechanism[SaslMechanism["None"] = -1] = "None";
            SaslMechanism[SaslMechanism["Plain"] = 0] = "Plain";
            SaslMechanism[SaslMechanism["DigestMd5"] = 1] = "DigestMd5";
            SaslMechanism[SaslMechanism["ScramSha1"] = 2] = "ScramSha1";
            SaslMechanism[SaslMechanism["Anonymous"] = 3] = "Anonymous";
        })(Sasl.SaslMechanism || (Sasl.SaslMechanism = {}));
        var SaslMechanism = Sasl.SaslMechanism;
        Object.freeze(SaslMechanism);
        /* order for choosing Sasl Mechanism */
        Sasl.saslMechanismPriorities = [
            2,
            1,
            0,
            3 // ANONYMOUS"
        ];
        function saslMechanismNameToEnum(val) {
            for (var i = 0; i < Matrix.Sasl.saslMechanismMapping.length; i++) {
                if (Matrix.Sasl.saslMechanismMapping[i] === val)
                    return i;
            }
            return SaslMechanism.None;
        }
        Sasl.saslMechanismNameToEnum = saslMechanismNameToEnum;
        function enumToSaslMechanismName(mech) {
            if (mech !== -1)
                return Matrix.Sasl.saslMechanismMapping[mech];
            return null;
        }
        Sasl.enumToSaslMechanismName = enumToSaslMechanismName;
    })(Sasl = Matrix.Sasl || (Matrix.Sasl = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Base;
        (function (Base) {
            "use strict";
            var XmppXElement = Matrix.Xml.XmppXElement;
            var Sasl = (function (_super) {
                __extends(Sasl, _super);
                function Sasl(tag) {
                    _super.call(this, Matrix.Namespaces.sasl, tag);
                }
                return Sasl;
            })(XmppXElement);
            Base.Sasl = Sasl;
        })(Base = Xmpp.Base || (Xmpp.Base = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../Sasl/SaslMechanism.ts" />
/// <reference path="../Base/Sasl.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Sasl;
        (function (Sasl) {
            "use strict";
            var Auth = (function (_super) {
                __extends(Auth, _super);
                function Auth(saslMechanism, value) {
                    _super.call(this, "auth");
                    if (!Matrix.Util.Functions.isUndefined(saslMechanism))
                        this.saslMechanism = saslMechanism;
                    if (!Matrix.Util.Functions.isUndefined(value))
                        this.value = value;
                }
                Object.defineProperty(Auth.prototype, "saslMechanism", {
                    get: function () {
                        var name = this.getAttribute("mechanism");
                        return Matrix.Sasl.saslMechanismNameToEnum(name);
                    },
                    set: function (value) {
                        this.setAttribute("mechanism", Matrix.Sasl.enumToSaslMechanismName(value));
                    },
                    enumerable: true,
                    configurable: true
                });
                return Auth;
            })(Xmpp.Base.Sasl);
            Sasl.Auth = Auth;
        })(Sasl = Xmpp.Sasl || (Xmpp.Sasl = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Sasl;
    (function (Sasl) {
        "use strict";
        var SaslProcessor = (function () {
            function SaslProcessor() {
            }
            Object.defineProperty(SaslProcessor.prototype, "xmppClient", {
                get: function () { return this._xmppClient; },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(SaslProcessor.prototype, "server", {
                get: function () { return this._server.toLowerCase(); },
                set: function (value) { this._server = value; },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(SaslProcessor.prototype, "username", {
                get: function () { return this._username; },
                set: function (value) { this._username = value; },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(SaslProcessor.prototype, "password", {
                get: function () { return this._password; },
                set: function (value) { this._password = value; },
                enumerable: true,
                configurable: true
            });
            SaslProcessor.prototype.init = function (xmppClient) {
                this._xmppClient = xmppClient;
            };
            SaslProcessor.prototype.parse = function (ch) {
            };
            return SaslProcessor;
        })();
        Sasl.SaslProcessor = SaslProcessor;
    })(Sasl = Matrix.Sasl || (Matrix.Sasl = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../typings/ltxml.d.ts" />
/// <reference path="../xmpp/sasl/auth.ts" />
/// <reference path="saslprocessor.ts" />
var Matrix;
(function (Matrix) {
    var Sasl;
    (function (Sasl) {
        "use strict";
        var Auth = Matrix.Xmpp.Sasl.Auth;
        var AnonymousProcessor = (function (_super) {
            __extends(AnonymousProcessor, _super);
            function AnonymousProcessor() {
                _super.apply(this, arguments);
            }
            AnonymousProcessor.prototype.init = function (xmppClient) {
                _super.prototype.init.call(this, xmppClient);
                xmppClient.send(new Auth(Sasl.SaslMechanism.Anonymous));
            };
            return AnonymousProcessor;
        })(Sasl.SaslProcessor);
        Sasl.AnonymousProcessor = AnonymousProcessor;
    })(Sasl = Matrix.Sasl || (Matrix.Sasl = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    (function (Transport) {
        Transport[Transport["Websocket"] = 0] = "Websocket";
        Transport[Transport["Bosh"] = 1] = "Bosh";
    })(Matrix.Transport || (Matrix.Transport = {}));
    var Transport = Matrix.Transport;
    Object.freeze(Transport);
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../xml/XmppXElement.ts" />
/// <reference path="../../Jid.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Base;
        (function (Base) {
            var XmppXElement = Matrix.Xml.XmppXElement;
            var XmppXElementWithJidAttribute = (function (_super) {
                __extends(XmppXElementWithJidAttribute, _super);
                function XmppXElementWithJidAttribute(ns, tagname) {
                    _super.call(this, ns, tagname);
                }
                Object.defineProperty(XmppXElementWithJidAttribute.prototype, "jid", {
                    get: function () { return this.getAttributeJid("jid"); },
                    set: function (value) { this.setAttributeJid("jid", value); },
                    enumerable: true,
                    configurable: true
                });
                return XmppXElementWithJidAttribute;
            })(XmppXElement);
            Base.XmppXElementWithJidAttribute = XmppXElementWithJidAttribute;
        })(Base = Xmpp.Base || (Xmpp.Base = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="XmppXElementWithJidAttribute.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Base;
        (function (Base) {
            var Item = (function (_super) {
                __extends(Item, _super);
                function Item(ns) {
                    _super.call(this, ns, "item");
                }
                Object.defineProperty(Item.prototype, "nickname", {
                    // TODO, find a better name here
                    get: function () { return this.getAttribute("name"); },
                    set: function (value) { this.setAttribute("name", value); },
                    enumerable: true,
                    configurable: true
                });
                return Item;
            })(Base.XmppXElementWithJidAttribute);
            Base.Item = Item;
        })(Base = Xmpp.Base || (Xmpp.Base = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Roster;
        (function (Roster) {
            (function (Ask) {
                Ask[Ask["None"] = -1] = "None";
                //[Name("subscribe")]
                Ask[Ask["Subscribe"] = 0] = "Subscribe";
                //[Name("unsubscribe")]
                Ask[Ask["Unsubscribe"] = 1] = "Unsubscribe";
            })(Roster.Ask || (Roster.Ask = {}));
            var Ask = Roster.Ask;
            Object.freeze(Ask);
        })(Roster = Xmpp.Roster || (Xmpp.Roster = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Roster;
        (function (Roster) {
            (function (Subscription) {
                /// <summary>
                /// the user does not have a subscription to the contact's presence information, 
                /// and the contact does not have a subscription to the user's presence information
                /// </summary>
                //[Name("none")]
                Subscription[Subscription["None"] = 0] = "None";
                /// <summary>
                /// the user has a subscription to the contact's presence information, but the contact does 
                /// not have a subscription to the user's presence information
                /// </summary>
                //[Name("to")]
                Subscription[Subscription["To"] = 1] = "To";
                /// <summary>
                /// the contact has a subscription to the user's presence information, but the user does not have a subscription 
                /// to the contact's presence information
                /// </summary>
                //[Name("from")]
                Subscription[Subscription["From"] = 2] = "From";
                /// <summary>
                /// both the user and the contact have subscriptions to each other's presence information
                /// </summary>
                //[Name("both")]
                Subscription[Subscription["Both"] = 3] = "Both";
                /// <summary>
                /// for requests to remove the contact from the roster
                /// </summary>
                //[Name("remove")]
                Subscription[Subscription["Remove"] = 4] = "Remove";
            })(Roster.Subscription || (Roster.Subscription = {}));
            var Subscription = Roster.Subscription;
            Object.freeze(Subscription);
        })(Roster = Xmpp.Roster || (Xmpp.Roster = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Roster/Ask.ts" />
/// <reference path="../Roster/Subscription.ts" />
/// <reference path="Item.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Base;
        (function (Base) {
            var RosterItem = (function (_super) {
                __extends(RosterItem, _super);
                function RosterItem(ns) {
                    _super.call(this, ns);
                }
                return RosterItem;
            })(Base.Item);
            Base.RosterItem = RosterItem;
        })(Base = Xmpp.Base || (Xmpp.Base = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    "use strict";
    var Id = (function () {
        function Id() {
        }
        Id.getNextId = function () {
            this._counter++;
            return this._prefix + this._counter;
        };
        Id._prefix = "MX_";
        Id._counter = 0;
        return Id;
    })();
    Matrix.Id = Id;
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="XmppXElementWithAddress.ts" />
/// <reference path="../../Id.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Base;
        (function (Base) {
            "use strict";
            var XmppXElementWithAddressAndId = (function (_super) {
                __extends(XmppXElementWithAddressAndId, _super);
                function XmppXElementWithAddressAndId(ns, tagname, prefix) {
                    _super.call(this, ns, tagname, prefix);
                }
                Object.defineProperty(XmppXElementWithAddressAndId.prototype, "id", {
                    get: function () {
                        return this.getAttribute("id");
                    },
                    set: function (value) {
                        this.setAttribute("id", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                /* Generates a automatic id for the packet. !!! Overwrites existing Ids */
                XmppXElementWithAddressAndId.prototype.generateId = function () {
                    var sId = Matrix.Id.getNextId();
                    this.id = sId;
                };
                return XmppXElementWithAddressAndId;
            })(Base.XmppXElementWithAddress);
            Base.XmppXElementWithAddressAndId = XmppXElementWithAddressAndId;
        })(Base = Xmpp.Base || (Xmpp.Base = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="XmppXElementWithAddressAndId.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Base;
        (function (Base) {
            "use strict";
            var XmppXElementWithAddressAndIdAndVersion = (function (_super) {
                __extends(XmppXElementWithAddressAndIdAndVersion, _super);
                function XmppXElementWithAddressAndIdAndVersion(ns, tagname, prefix) {
                    _super.call(this, ns, tagname, prefix);
                }
                Object.defineProperty(XmppXElementWithAddressAndIdAndVersion.prototype, "version", {
                    get: function () { return this.getAttribute("version"); },
                    set: function (value) { this.setAttribute("version", value); },
                    enumerable: true,
                    configurable: true
                });
                return XmppXElementWithAddressAndIdAndVersion;
            })(Base.XmppXElementWithAddressAndId);
            Base.XmppXElementWithAddressAndIdAndVersion = XmppXElementWithAddressAndIdAndVersion;
        })(Base = Xmpp.Base || (Xmpp.Base = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../Xml/XmppXElement.ts" />
/// <reference path="../../Namespaces.ts" />
/// <reference path="../../Jid.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Bind;
        (function (Bind_1) {
            var XmppXElement = Matrix.Xml.XmppXElement;
            var Bind = (function (_super) {
                __extends(Bind, _super);
                function Bind() {
                    _super.call(this, Matrix.Namespaces.bind, "bind");
                }
                Object.defineProperty(Bind.prototype, "resource", {
                    get: function () {
                        return this.getTag("resource");
                    },
                    set: function (value) {
                        this.setTag("resource", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Bind.prototype, "jid", {
                    get: function () {
                        return this.getTagJid("jid");
                    },
                    set: function (value) {
                        this.setTag("jid", value.toString());
                    },
                    enumerable: true,
                    configurable: true
                });
                return Bind;
            })(XmppXElement);
            Bind_1.Bind = Bind;
        })(Bind = Xmpp.Bind || (Xmpp.Bind = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        "use strict";
        (function (IqType) {
            IqType[IqType["Get"] = 0] = "Get";
            IqType[IqType["Set"] = 1] = "Set";
            IqType[IqType["Result"] = 2] = "Result";
            IqType[IqType["Error"] = 3] = "Error";
        })(Xmpp.IqType || (Xmpp.IqType = {}));
        var IqType = Xmpp.IqType;
        Object.freeze(IqType);
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="XmppXElementWithAddressAndId.ts" />
/// <reference path="../IqType.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Base;
        (function (Base) {
            "use strict";
            var Iq = (function (_super) {
                __extends(Iq, _super);
                function Iq(ns) {
                    _super.call(this, ns, "iq");
                }
                Object.defineProperty(Iq.prototype, "type", {
                    get: function () {
                        return this.getAttributeEnum("type", Xmpp.IqType);
                    },
                    set: function (value) {
                        this.setAttributeEnum("type", Xmpp.IqType, value);
                    },
                    enumerable: true,
                    configurable: true
                });
                return Iq;
            })(Base.XmppXElementWithAddressAndId);
            Base.Iq = Iq;
        })(Base = Xmpp.Base || (Xmpp.Base = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Base/Iq.ts" />
/// <reference path="../../Namespaces.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Client;
        (function (Client) {
            "use strict";
            var Iq = (function (_super) {
                __extends(Iq, _super);
                function Iq() {
                    _super.call(this, Matrix.Namespaces.client);
                }
                return Iq;
            })(Xmpp.Base.Iq);
            Client.Iq = Iq;
        })(Client = Xmpp.Client || (Xmpp.Client = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="Iq.ts" />
/// <reference path="../../Xml/XmppXElement.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Client;
        (function (Client) {
            "use strict";
            var IqQuery = (function (_super) {
                __extends(IqQuery, _super);
                function IqQuery(query) {
                    _super.call(this);
                    this._query = new query();
                    this.add(this._query);
                }
                Object.defineProperty(IqQuery.prototype, "query", {
                    get: function () {
                        return this._query;
                    },
                    enumerable: true,
                    configurable: true
                });
                return IqQuery;
            })(Client.Iq);
            Client.IqQuery = IqQuery;
        })(Client = Xmpp.Client || (Xmpp.Client = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Base/XmppXElementWithAddress.ts" />
/// <reference path="../../Namespaces.ts" />
/// <reference path="../../Jid.ts" />
/// <reference path="../../Util/Time.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Delay;
        (function (Delay_1) {
            /*
             * <body
             *  rid='1996404094'
             *  xmlns='http://jabber.org/protocol/httpbind'
             *  to='anon.ag-software.net'
             *  xml:lang='en'
             *  wait='60'
             *  hold='1'
             *  content='text/xml; charset=utf-8' ver='1.6'
             *  xmpp:version='1.0'
             *  xmlns:xmpp='urn:xmpp:xbosh'/>
             */
            var XmppXElementWithAddress = Matrix.Xmpp.Base.XmppXElementWithAddress;
            var Delay = (function (_super) {
                __extends(Delay, _super);
                function Delay() {
                    _super.call(this, Matrix.Namespaces.delay, "delay");
                }
                Object.defineProperty(Delay.prototype, "stamp", {
                    get: function () {
                        return this.getAttributeIso8601Date("stamp");
                    },
                    set: function (value) {
                        this.setAttributeIso8601Date("stamp", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                return Delay;
            })(XmppXElementWithAddress);
            Delay_1.Delay = Delay;
        })(Delay = Xmpp.Delay || (Xmpp.Delay = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../Xml/XmppXElement.ts" />
/// <reference path="../../Namespaces.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Framing;
        (function (Framing) {
            var XmppXElement = Matrix.Xml.XmppXElement;
            var Close = (function (_super) {
                __extends(Close, _super);
                function Close() {
                    _super.call(this, Matrix.Namespaces.framing, "close");
                }
                return Close;
            })(XmppXElement);
            Framing.Close = Close;
        })(Framing = Xmpp.Framing || (Xmpp.Framing = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Base/XmppXElementWithAddressAndIdAndVersion.ts" />
/// <reference path="../../Namespaces.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Framing;
        (function (Framing) {
            var XmppXElementWithAddressAndIdAndVersion = Matrix.Xmpp.Base.XmppXElementWithAddressAndIdAndVersion;
            var Open = (function (_super) {
                __extends(Open, _super);
                function Open() {
                    _super.call(this, Matrix.Namespaces.framing, "open");
                }
                return Open;
            })(XmppXElementWithAddressAndIdAndVersion);
            Framing.Open = Open;
        })(Framing = Xmpp.Framing || (Xmpp.Framing = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Muc;
        (function (Muc) {
            "use strict";
            (function (Affiliation) {
                /// <summary>
                /// the absence of an affiliation
                /// </summary>
                //[Name("none")]
                Affiliation[Affiliation["None"] = 0] = "None";
                //[Name("owner")]
                Affiliation[Affiliation["Owner"] = 1] = "Owner";
                //[Name("admin")]
                Affiliation[Affiliation["Admin"] = 2] = "Admin";
                //[Name("member")]
                Affiliation[Affiliation["Member"] = 3] = "Member";
                //[Name("outcast")]
                Affiliation[Affiliation["Outcast"] = 4] = "Outcast";
            })(Muc.Affiliation || (Muc.Affiliation = {}));
            var Affiliation = Muc.Affiliation;
            Object.freeze(Affiliation);
        })(Muc = Xmpp.Muc || (Xmpp.Muc = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Base/XmppXElementWithJidAttribute.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Muc;
        (function (Muc) {
            "use strict";
            var XmppXElementWithJidAttribute = Xmpp.Base.XmppXElementWithJidAttribute;
            var Conference = (function (_super) {
                __extends(Conference, _super);
                function Conference() {
                    _super.call(this, Matrix.Namespaces.xConference, "x");
                }
                Object.defineProperty(Conference.prototype, "password", {
                    get: function () {
                        return this.getAttribute("password");
                    },
                    set: function (value) {
                        this.setAttribute("password", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Conference.prototype, "reason", {
                    get: function () {
                        return this.getAttribute("reason");
                    },
                    set: function (value) {
                        this.setAttribute("reason", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                return Conference;
            })(XmppXElementWithJidAttribute);
            Muc.Conference = Conference;
        })(Muc = Xmpp.Muc || (Xmpp.Muc = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../Xml/XmppXElement.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Muc;
        (function (Muc) {
            "use strict";
            var XmppXElement = Matrix.Xml.XmppXElement;
            var History = (function (_super) {
                __extends(History, _super);
                function History() {
                    _super.call(this, Matrix.Namespaces.muc, "history");
                }
                Object.defineProperty(History.prototype, "seconds", {
                    /// <summary>
                    /// request the last xxx seconds of history when available
                    /// </summary>
                    get: function () {
                        return this.getAttributeNumber("seconds");
                    },
                    set: function (value) {
                        this.setAttributeNumber("seconds", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(History.prototype, "maxStanzas", {
                    /// <summary>
                    /// Request maximum stanzas of history when available
                    /// </summary>
                    get: function () {
                        return this.getAttributeNumber("maxstanzas");
                    },
                    set: function (value) {
                        this.setAttributeNumber("maxstanzas", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(History.prototype, "since", {
                    /// <summary>
                    /// Request history from a given date when available
                    /// </summary>
                    get: function () {
                        return this.getAttributeIso8601Date("since");
                    },
                    set: function (value) {
                        this.setAttributeIso8601Date("since", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(History.prototype, "maxCharacters", {
                    /// <summary>
                    /// Limit the total number of characters in the history to "X" 
                    /// (where the character count is the characters of the complete XML stanzas, 
                    /// not only their XML character data).
                    /// </summary>
                    get: function () {
                        return this.getAttributeNumber("maxchars");
                    },
                    set: function (value) {
                        this.setAttributeNumber("maxchars", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                return History;
            })(XmppXElement);
            Muc.History = History;
        })(Muc = Xmpp.Muc || (Xmpp.Muc = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Base/Item.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Muc;
        (function (Muc) {
            "use strict";
            var Item = (function (_super) {
                __extends(Item, _super);
                function Item(ns) {
                    _super.call(this, ns);
                }
                Object.defineProperty(Item.prototype, "role", {
                    get: function () {
                        return this.getAttributeEnum("role", Muc.Role);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Item.prototype, "type", {
                    set: function (value) {
                        this.setAttributeEnum("role", Muc.Role, value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Item.prototype, "affiliation", {
                    get: function () {
                        return this.getAttributeEnum("affiliation", Muc.Affiliation);
                    },
                    set: function (value) {
                        this.setAttributeEnum("affiliation", Muc.Affiliation, value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Item.prototype, "nick", {
                    get: function () {
                        return this.getAttribute("nick");
                    },
                    set: function (value) {
                        this.setAttribute("nick", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Item.prototype, "reason", {
                    get: function () {
                        return this.getTag("reason");
                    },
                    set: function (value) {
                        this.setTag("reason", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                return Item;
            })(Xmpp.Base.Item);
            Muc.Item = Item;
        })(Muc = Xmpp.Muc || (Xmpp.Muc = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Muc;
        (function (Muc) {
            "use strict";
            (function (Role) {
                /// <summary>
                /// the absence of a role
                /// </summary>
                //[Name("none")]
                Role[Role["None"] = 0] = "None";
                /// <summary>
                /// A moderator is the most powerful occupant within the context of the room, 
                /// and can to some extent manage other occupants's roles in the room.
                /// </summary>
                //[Name("moderator")]
                Role[Role["Moderator"] = 1] = "Moderator";
                /// <summary>
                /// A participant has fewer privileges than a moderator, although he or she always has the right to speak.
                /// </summary>
                //[Name("participant")]
                Role[Role["Participant"] = 2] = "Participant";
                /// <summary>
                /// A visitor is a more restricted role within the context of a moderated room, 
                /// since visitors are not allowed to send messages to all occupants.
                /// </summary>
                //[Name("visitor")]
                Role[Role["Visitor"] = 3] = "Visitor";
            })(Muc.Role || (Muc.Role = {}));
            var Role = Muc.Role;
            Object.freeze(Role);
        })(Muc = Xmpp.Muc || (Xmpp.Muc = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../Base/XmppXElementWithJidAttribute.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Muc;
        (function (Muc) {
            var User;
            (function (User) {
                "use strict";
                var XmppXElementWithJidAttribute = Matrix.Xmpp.Base.XmppXElementWithJidAttribute;
                var Actor = (function (_super) {
                    __extends(Actor, _super);
                    function Actor() {
                        _super.call(this, Matrix.Namespaces.mucUser, "actor");
                    }
                    Object.defineProperty(Actor.prototype, "nick", {
                        get: function () {
                            return this.getAttribute("nick");
                        },
                        set: function (value) {
                            this.setAttribute("nick", value);
                        },
                        enumerable: true,
                        configurable: true
                    });
                    return Actor;
                })(XmppXElementWithJidAttribute);
                User.Actor = Actor;
            })(User = Muc.User || (Muc.User = {}));
        })(Muc = Xmpp.Muc || (Xmpp.Muc = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../../Xml/XmppXElement.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Muc;
        (function (Muc) {
            var User;
            (function (User) {
                "use strict";
                var XmppXElement = Matrix.Xml.XmppXElement;
                var Continue = (function (_super) {
                    __extends(Continue, _super);
                    function Continue() {
                        _super.call(this, Matrix.Namespaces.mucUser, "continue");
                    }
                    Object.defineProperty(Continue.prototype, "thread", {
                        get: function () {
                            return this.getAttribute("tread");
                        },
                        set: function (value) {
                            this.setAttribute("thread", value);
                        },
                        enumerable: true,
                        configurable: true
                    });
                    return Continue;
                })(XmppXElement);
                User.Continue = Continue;
            })(User = Muc.User || (Muc.User = {}));
        })(Muc = Xmpp.Muc || (Xmpp.Muc = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../../Xml/XmppXElement.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Muc;
        (function (Muc) {
            var User;
            (function (User) {
                "use strict";
                var XmppXElement = Matrix.Xml.XmppXElement;
                var Status = (function (_super) {
                    __extends(Status, _super);
                    function Status() {
                        _super.call(this, Matrix.Namespaces.mucUser, "status");
                    }
                    Object.defineProperty(Status.prototype, "codeInt", {
                        get: function () {
                            return this.getAttributeNumber("code");
                        },
                        set: function (value) {
                            this.setAttributeNumber("code", value);
                        },
                        enumerable: true,
                        configurable: true
                    });
                    Object.defineProperty(Status.prototype, "statusCode", {
                        get: function () {
                            var code = this.codeInt;
                            if (code > 0)
                                return code;
                            else
                                return User.StatusCode.Unknown;
                        },
                        set: function (value) {
                            if (value != User.StatusCode.Unknown)
                                this.codeInt = value;
                        },
                        enumerable: true,
                        configurable: true
                    });
                    return Status;
                })(XmppXElement);
                User.Status = Status;
            })(User = Muc.User || (Muc.User = {}));
        })(Muc = Xmpp.Muc || (Xmpp.Muc = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Muc;
        (function (Muc) {
            var User;
            (function (User) {
                "use strict";
                (function (StatusCode) {
                    /// <summary>
                    /// Unkown status code.
                    /// </summary>
                    StatusCode[StatusCode["Unknown"] = -1] = "Unknown";
                    /// <summary>
                    /// Inform user that any occupant is allowed to see the user's full JID.
                    /// </summary>
                    StatusCode[StatusCode["FullJidVisible"] = 100] = "FullJidVisible";
                    /// <summary>
                    /// Inform user that his or her affiliation changed while not in the room.
                    /// </summary>
                    StatusCode[StatusCode["AffiliationChanged"] = 101] = "AffiliationChanged";
                    /// <summary>
                    /// Inform occupants that room now shows unavailable members.
                    /// </summary>
                    StatusCode[StatusCode["ShowUnavailableMembers"] = 102] = "ShowUnavailableMembers";
                    /// <summary>
                    /// Inform occupants that room now does not show unavailable members .
                    /// </summary>
                    StatusCode[StatusCode["HideUnavailableMembers"] = 103] = "HideUnavailableMembers";
                    /// <summary>
                    /// Inform occupants that a non-privacy-related room configuration change has occurred.
                    /// </summary>
                    StatusCode[StatusCode["ConfigurationChanged"] = 104] = "ConfigurationChanged";
                    /// <summary>
                    /// Inform user that presence refers to one of its own room occupants .
                    /// </summary>
                    StatusCode[StatusCode["SelfPresence"] = 110] = "SelfPresence";
                    /// <summary>
                    /// Inform occupants that room logging is now enabled.
                    /// </summary>
                    StatusCode[StatusCode["LoggingEnabled"] = 170] = "LoggingEnabled";
                    /// <summary>
                    /// Inform occupants that room logging is now disabled. 
                    /// </summary>
                    StatusCode[StatusCode["LoggingDisabled"] = 171] = "LoggingDisabled";
                    /// <summary>
                    /// Inform occupants that the room is now non-anonymous.
                    /// </summary>
                    StatusCode[StatusCode["RoomNonAnonymous"] = 172] = "RoomNonAnonymous";
                    /// <summary>
                    /// Inform occupants that the room is now semi-anonymous.
                    /// </summary>
                    StatusCode[StatusCode["RoomSemiAnonymous"] = 173] = "RoomSemiAnonymous";
                    /// <summary>
                    /// Inform occupants that the room is now fully-anonymous. 
                    /// </summary>
                    StatusCode[StatusCode["RoomAnonymous"] = 174] = "RoomAnonymous";
                    /// <summary>
                    /// Inform user that a new room has been created. 
                    /// </summary>
                    StatusCode[StatusCode["RoomCreated"] = 201] = "RoomCreated";
                    /// <summary>
                    ///  Inform user that service has assigned or modified occupant's roomnick.
                    /// </summary>
                    StatusCode[StatusCode["ModifiedNick"] = 210] = "ModifiedNick";
                    /// <summary>
                    /// Inform user that he or she has been banned from the room. 
                    /// </summary>
                    StatusCode[StatusCode["Banned"] = 301] = "Banned";
                    /// <summary>
                    /// Inform all occupants of new room nickname. 
                    /// </summary>
                    StatusCode[StatusCode["NewNickname"] = 303] = "NewNickname";
                    /// <summary>
                    /// Inform user that he or she has been kicked from the room. 
                    /// </summary>
                    StatusCode[StatusCode["Kicked"] = 307] = "Kicked";
                    /// <summary>
                    /// Inform user that he or she is being removed from the room because of an affiliation change.
                    /// </summary>
                    // TODO, find better name
                    StatusCode[StatusCode["AffiliationChange"] = 321] = "AffiliationChange";
                    /// <summary>
                    /// Inform user that he or she is being removed from the room because the room 
                    /// has been changed to members-only and the user is not a member.
                    /// </summary>
                    StatusCode[StatusCode["MembersOnly"] = 322] = "MembersOnly";
                    /// <summary>
                    /// Inform user that he or she is being removed from the room because of a system shutdown.
                    /// </summary>
                    StatusCode[StatusCode["Shutdown"] = 332] = "Shutdown";
                })(User.StatusCode || (User.StatusCode = {}));
                var StatusCode = User.StatusCode;
            })(User = Muc.User || (Muc.User = {}));
        })(Muc = Xmpp.Muc || (Xmpp.Muc = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../Xml/XmppXElement.ts" />
/// <reference path="History.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Muc;
        (function (Muc) {
            "use strict";
            var XmppXElement = Matrix.Xml.XmppXElement;
            var X = (function (_super) {
                __extends(X, _super);
                function X() {
                    _super.call(this, Matrix.Namespaces.muc, "X");
                }
                Object.defineProperty(X.prototype, "password", {
                    get: function () {
                        return this.getAttribute("password");
                    },
                    set: function (value) {
                        this.setAttribute("password", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(X.prototype, "history", {
                    get: function () {
                        return this.elementOfType(Muc.History);
                    },
                    set: function (value) {
                        this.replace(Muc.History, value);
                    },
                    enumerable: true,
                    configurable: true
                });
                return X;
            })(XmppXElement);
            Muc.X = X;
        })(Muc = Xmpp.Muc || (Xmpp.Muc = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
* Copyright (C) Alexander Gnauck, AG-Software
* Web: http://www.ag-software.de
* Email: alex@ag-software.net *
*/
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        "use strict";
        (function (PresenceType) {
            /// <summary>
            /// Used when one wants to send presence to someone/server/transport that you’re available. 
            /// </summary>
            //[Name("available")]
            PresenceType[PresenceType["Available"] = -1] = "Available";
            /// <summary>
            /// Used to send a subscription request to someone.
            /// </summary>
            //[Name("subscribe")]
            PresenceType[PresenceType["Subscribe"] = 0] = "Subscribe";
            /// <summary>
            /// Used to accept a subscription request.
            /// </summary>		
            //[Name("subscribed")]
            PresenceType[PresenceType["Subscribed"] = 1] = "Subscribed";
            /// <summary>
            /// Used to unsubscribe someone from your presence. 
            /// </summary>
            //[Name("unsubscribe")]
            PresenceType[PresenceType["Unsubscribe"] = 2] = "Unsubscribe";
            /// <summary>
            /// Used to deny a subscription request.
            /// </summary>
            //[Name("unsubscribed")]
            PresenceType[PresenceType["Unsubscribed"] = 3] = "Unsubscribed";
            /// <summary>
            /// Used when one wants to send presence to someone/server/transport that you’re unavailable.
            /// </summary>
            //[Name("unavailable")]
            PresenceType[PresenceType["Unavailable"] = 4] = "Unavailable";
            /// <summary>
            /// Used when you want to see your roster, but don't want anyone on you roster to see you
            /// </summary>
            //[Name("invisible")]
            PresenceType[PresenceType["Invisible"] = 5] = "Invisible";
            /// <summary>
            /// If a user chooses to become visible after being invisible, the client will send undirected presence with a type="visible" attribute.
            /// </summary>
            //[Name("visible")]
            PresenceType[PresenceType["Visible"] = 6] = "Visible";
            /// <summary>
            /// presence error
            /// </summary>
            //[Name("error")]
            PresenceType[PresenceType["Error"] = 7] = "Error";
            /// <summary>
            /// used in server to server protocol to request presences
            /// </summary>
            //[Name("probe")]
            PresenceType[PresenceType["Probe"] = 8] = "Probe";
        })(Xmpp.PresenceType || (Xmpp.PresenceType = {}));
        var PresenceType = Xmpp.PresenceType;
        Object.freeze(PresenceType);
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../base/RosterItem.ts" />
/// <reference path="../../Namespaces.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Roster;
        (function (Roster) {
            var RosterItem = (function (_super) {
                __extends(RosterItem, _super);
                function RosterItem() {
                    _super.call(this, Matrix.Namespaces.iqRoster);
                }
                Object.defineProperty(RosterItem.prototype, "subscription", {
                    get: function () {
                        return this.getAttributeEnum("subscription", Roster.Subscription);
                    },
                    set: function (value) {
                        this.setAttributeEnum("subscription", Roster.Subscription, value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(RosterItem.prototype, "ask", {
                    get: function () {
                        return this.getAttributeEnum("ask", Roster.Ask);
                    },
                    set: function (value) {
                        this.setAttributeEnum("ask", Roster.Ask, value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(RosterItem.prototype, "approved", {
                    get: function () {
                        return this.getAttributeBoolean("approved");
                    },
                    set: function (value) {
                        this.setAttributeBoolean("approved", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                return RosterItem;
            })(Matrix.Xmpp.Base.RosterItem);
            Roster.RosterItem = RosterItem;
        })(Roster = Xmpp.Roster || (Xmpp.Roster = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../Xml/XmppXElement.ts" />
/// <reference path="RosterItem.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Roster;
        (function (Roster_1) {
            var XmppXElement = Matrix.Xml.XmppXElement;
            var Roster = (function (_super) {
                __extends(Roster, _super);
                function Roster() {
                    _super.call(this, Matrix.Namespaces.iqRoster, "query");
                }
                Roster.prototype.getRoster = function () {
                    return this.elementsOfType(Matrix.Xmpp.Roster.RosterItem);
                };
                Object.defineProperty(Roster.prototype, "version", {
                    get: function () {
                        return this.getAttribute("ver");
                    },
                    set: function (value) {
                        this.setAttribute("ver", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                return Roster;
            })(XmppXElement);
            Roster_1.Roster = Roster;
        })(Roster = Xmpp.Roster || (Xmpp.Roster = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../Eventargs.ts" />
/// <reference path="RosterItem.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Roster;
        (function (Roster) {
            var RosterEventArgs = (function (_super) {
                __extends(RosterEventArgs, _super);
                function RosterEventArgs(rosterItem, version) {
                    _super.call(this);
                    this.rosterItem = rosterItem;
                    this.version = version;
                }
                Object.defineProperty(RosterEventArgs.prototype, "rosterItem", {
                    get: function () { return this._rosterItem; },
                    set: function (value) { this._rosterItem = value; },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(RosterEventArgs.prototype, "version", {
                    get: function () { return this._version; },
                    set: function (value) { this._version = value; },
                    enumerable: true,
                    configurable: true
                });
                return RosterEventArgs;
            })(Matrix.EventArgs);
            Roster.RosterEventArgs = RosterEventArgs;
        })(Roster = Xmpp.Roster || (Xmpp.Roster = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../Xml/XmppXElement.ts" />
/// <reference path="../../Namespaces.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Session;
        (function (Session_1) {
            var XmppXElement = Matrix.Xml.XmppXElement;
            var Session = (function (_super) {
                __extends(Session, _super);
                function Session() {
                    _super.call(this, Matrix.Namespaces.session, "session");
                }
                return Session;
            })(XmppXElement);
            Session_1.Session = Session;
        })(Session = Xmpp.Session || (Xmpp.Session = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        // array for mapping to the enum
        Xmpp.showMapping = [
            null,
            "away",
            "chat",
            "dnd",
            "xa"
        ];
        Object.freeze(Xmpp.showMapping);
        (function (Show) {
            /// <summary>
            /// 
            /// </summary>
            Show[Show["None"] = -1] = "None";
            /// <summary>
            /// The entity or resource is temporarily away.
            /// </summary>
            //[Name("away")]
            Show[Show["Away"] = 0] = "Away";
            /// <summary>
            /// The entity or resource is actively interested in chatting.
            /// </summary>
            //[Name("chat")]
            Show[Show["Chat"] = 1] = "Chat";
            /// <summary>
            /// The entity or resource is busy (dnd = "Do Not Disturb").
            /// </summary>
            //[Name("dnd")]
            Show[Show["DoNotDisturb"] = 2] = "DoNotDisturb";
            /// <summary>
            /// The entity or resource is away for an extended period (xa = "eXtended Away").
            /// </summary>
            //[Name("xa")]
            Show[Show["ExtendedAway"] = 3] = "ExtendedAway";
        })(Xmpp.Show || (Xmpp.Show = {}));
        var Show = Xmpp.Show;
        Object.freeze(Show);
        function showNameToEnum(val) {
            for (var i = 0; i < Xmpp.showMapping.length; i++) {
                if (Xmpp.showMapping[i] === val)
                    return i;
            }
            return Show.None;
        }
        Xmpp.showNameToEnum = showNameToEnum;
        function enumToShowName(show) {
            if (show !== -1)
                return Xmpp.showMapping[show];
            return null;
        }
        Xmpp.enumToShowName = enumToShowName;
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="Xmpp/Client/iq.ts" />
/// <reference path="EventArgs.ts" />
var Matrix;
(function (Matrix) {
    "use strict";
    var IqEventArgs = (function (_super) {
        __extends(IqEventArgs, _super);
        function IqEventArgs(iq) {
            _super.call(this);
            this.iq = iq;
        }
        Object.defineProperty(IqEventArgs.prototype, "iq", {
            get: function () { return this._iq; },
            set: function (value) { this._iq = value; },
            enumerable: true,
            configurable: true
        });
        return IqEventArgs;
    })(Matrix.EventArgs);
    Matrix.IqEventArgs = IqEventArgs;
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="IqEventArgs.ts" />
var Matrix;
(function (Matrix) {
    "use strict";
    var FilterData = (function () {
        function FilterData(iqCallback, state) {
            if (iqCallback)
                this.iqCallback = iqCallback;
            if (state)
                this.state = state;
        }
        Object.defineProperty(FilterData.prototype, "id", {
            get: function () { return this._id; },
            set: function (value) { this._id = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FilterData.prototype, "state", {
            get: function () { return this._state; },
            set: function (value) { this._state = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FilterData.prototype, "iqCallback", {
            get: function () { return this._iqCallback; },
            set: function (value) { this._iqCallback = value; },
            enumerable: true,
            configurable: true
        });
        return FilterData;
    })();
    Matrix.FilterData = FilterData;
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../EventArgs.ts" />
/// <reference path="../../Sasl/SaslMechanism.ts" />
/// <reference path="../../Sasl/SaslProcessor.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Sasl;
        (function (Sasl) {
            "use strict";
            var SaslEventArgs = (function (_super) {
                __extends(SaslEventArgs, _super);
                function SaslEventArgs(failure) {
                    _super.call(this);
                    if (failure)
                        this._failure = failure;
                }
                Object.defineProperty(SaslEventArgs.prototype, "auto", {
                    /// <summary>
                    /// Should the library automatically choose the most appropriate SASL mechanism?
                    /// When set to false you have to specify the SASL mechanism manual.
                    /// </summary>
                    get: function () { return this._auto; },
                    set: function (value) { this._auto = value; },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(SaslEventArgs.prototype, "mechanisms", {
                    get: function () { return this._mechanisms; },
                    set: function (value) { this._mechanisms = value; },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(SaslEventArgs.prototype, "saslMechanism", {
                    get: function () { return this._saslMechanism; },
                    set: function (value) { this._saslMechanism = value; },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(SaslEventArgs.prototype, "customSaslProcessor", {
                    get: function () { return this._customSaslProcessor; },
                    set: function (value) { this._customSaslProcessor = value; },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(SaslEventArgs.prototype, "failure", {
                    get: function () { return this._failure; },
                    set: function (value) { this._failure = value; },
                    enumerable: true,
                    configurable: true
                });
                return SaslEventArgs;
            })(Matrix.EventArgs);
            Sasl.SaslEventArgs = SaslEventArgs;
        })(Sasl = Xmpp.Sasl || (Xmpp.Sasl = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="XmppXElementWithAddressAndId.ts" />
/// <reference path="../Show.ts" />
/// <reference path="../PresenceType.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Base;
        (function (Base) {
            "use strict";
            var Presence = (function (_super) {
                __extends(Presence, _super);
                function Presence(ns) {
                    _super.call(this, ns, "presence");
                }
                Object.defineProperty(Presence.prototype, "type", {
                    get: function () {
                        var presType = this.getAttribute("type");
                        if (presType == null)
                            return Xmpp.PresenceType.Available;
                        else
                            return Matrix.Util.Enum.parse(Xmpp.PresenceType, presType);
                    },
                    set: function (value) {
                        if (value == Xmpp.PresenceType.Available)
                            this.removeAttribute("type");
                        this.setAttribute("type", Matrix.Util.Enum.toString(Xmpp.PresenceType, value));
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Presence.prototype, "show", {
                    get: function () {
                        if (this.hasTag("show"))
                            return Xmpp.showNameToEnum(this.getTag("show"));
                        return Xmpp.Show.None;
                    },
                    set: function (value) {
                        if (value == Xmpp.Show.None)
                            this.removeTag("show");
                        else
                            this.setTag("show", Xmpp.enumToShowName(value));
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Presence.prototype, "priority", {
                    get: function () {
                        if (this.hasTag("priority"))
                            return parseInt(this.getTag("priority"));
                        return 0;
                    },
                    set: function (value) {
                        this.setTag("priority", value.toString());
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Presence.prototype, "status", {
                    get: function () {
                        return this.getTag("status");
                    },
                    set: function (value) {
                        this.setTag("status", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                return Presence;
            })(Base.XmppXElementWithAddressAndId);
            Base.Presence = Presence;
        })(Base = Xmpp.Base || (Xmpp.Base = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Base/Presence.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Client;
        (function (Client) {
            "use strict";
            var Presence = (function (_super) {
                __extends(Presence, _super);
                function Presence() {
                    _super.call(this, Matrix.Namespaces.client);
                }
                return Presence;
            })(Xmpp.Base.Presence);
            Client.Presence = Presence;
        })(Client = Xmpp.Client || (Xmpp.Client = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
// based on:
// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com
var Matrix;
(function (Matrix) {
    var Util;
    (function (Util) {
        var Base64;
        (function (Base64) {
            "use strict";
            var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
            /**
                 * Encodes a string in base64
                 * @param {String} input The string to encode in base64.
                 */
            function encode(input) {
                var output = "";
                var chr1, chr2, chr3;
                var enc1, enc2, enc3, enc4;
                var i = 0;
                do {
                    chr1 = input.charCodeAt(i++);
                    chr2 = input.charCodeAt(i++);
                    chr3 = input.charCodeAt(i++);
                    enc1 = chr1 >> 2;
                    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
                    enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
                    enc4 = chr3 & 63;
                    if (isNaN(chr2)) {
                        enc3 = enc4 = 64;
                    }
                    else if (isNaN(chr3)) {
                        enc4 = 64;
                    }
                    output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) +
                        keyStr.charAt(enc3) + keyStr.charAt(enc4);
                } while (i < input.length);
                return output;
            }
            Base64.encode = encode;
            /**
                 * Decodes a base64 string.
                 * @param {String} input The string to decode.
                 */
            function decode(input) {
                var output = "";
                var chr1, chr2, chr3;
                var enc1, enc2, enc3, enc4;
                var i = 0;
                // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
                input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
                do {
                    enc1 = keyStr.indexOf(input.charAt(i++));
                    enc2 = keyStr.indexOf(input.charAt(i++));
                    enc3 = keyStr.indexOf(input.charAt(i++));
                    enc4 = keyStr.indexOf(input.charAt(i++));
                    chr1 = (enc1 << 2) | (enc2 >> 4);
                    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                    chr3 = ((enc3 & 3) << 6) | enc4;
                    output = output + String.fromCharCode(chr1);
                    if (enc3 != 64) {
                        output = output + String.fromCharCode(chr2);
                    }
                    if (enc4 != 64) {
                        output = output + String.fromCharCode(chr3);
                    }
                } while (i < input.length);
                return output;
            }
            Base64.decode = decode;
        })(Base64 = Util.Base64 || (Util.Base64 = {}));
    })(Util = Matrix.Util || (Matrix.Util = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Xml/XmppXElement.ts" />
/// <reference path="ISocket.ts" />
var Matrix;
(function (Matrix) {
    var Net;
    (function (Net) {
        var WebSocketEx = (function () {
            function WebSocketEx(xmppClient) {
                this.onReadData = new Matrix.GenericEvent();
                this.onWriteData = new Matrix.GenericEvent();
                this.onConnect = new Matrix.GenericEvent();
                this.onDisconnect = new Matrix.GenericEvent();
                this.onError = new Matrix.GenericEvent();
                this._xmppClient = xmppClient;
            }
            WebSocketEx.prototype.connect = function () {
                var _this = this;
                //var url = Util.Functions.textFormat(this.WEBSOCKET_URI_TPL, this.hostname, this.port);
                this.webSocket = new WebSocket(this._xmppClient.uri, 'xmpp');
                this.webSocket.onerror = function () {
                    console.log('Websocket onerror');
                };
                this.webSocket.onopen = function () {
                    _this.onConnect.trigger(new Matrix.EventArgs());
                };
                this.webSocket.onclose = function () {
                    _this.onDisconnect.trigger(new Matrix.EventArgs());
                };
                this.webSocket.onmessage = function (e) {
                    console.log("RECV: " + e.data);
                    _this.onReadData.trigger(new Matrix.TextEventArgs(e.data));
                };
            };
            WebSocketEx.prototype.disconnect = function () {
                this.webSocket.close();
            };
            WebSocketEx.prototype.send = function (data) {
                var toSend;
                if (typeof data === 'string')
                    toSend = data;
                else
                    toSend = data.toString();
                console.log("RECV: " + toSend);
                this.webSocket.send(toSend);
                this.onWriteData.trigger(new Matrix.TextEventArgs(toSend));
            };
            return WebSocketEx;
        })();
        Net.WebSocketEx = WebSocketEx;
    })(Net = Matrix.Net || (Matrix.Net = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="iqeventargs.ts" />
/// <reference path="exceptioneventargs.ts" />
/// <reference path="xmpp/sasl/sasleventargs.ts" />
/// <reference path="net/boshsocket.ts" />
/// <reference path="net/isocket.ts" />
/// <reference path="xmpp/client/presence.ts" />
/// <reference path="xmpp/show.ts" />
/// <reference path="xmpp/roster/rostereventargs.ts" />
/// <reference path="jideventargs.ts" />
/// <reference path="iqfilter.ts" />
/// <reference path="util/base64.ts" />
/// <reference path="Events.ts" />
/// <reference path="net/WebSocketEx.ts" />
/// <reference path="_references.ts" />
/// <reference path="xmpp/sasl/sasleventargs.ts" />
/// <reference path="xmpp/client/iqquery.ts" />
/// <reference path="net/isocket.ts" />
var Matrix;
(function (Matrix) {
    "use strict";
    var WebSocketEx = Matrix.Net.WebSocketEx;
    var XmppXElement = Matrix.Xml.XmppXElement;
    var Iq = Matrix.Xmpp.Client.Iq;
    var IqQuery = Matrix.Xmpp.Client.IqQuery;
    var IqType = Matrix.Xmpp.IqType;
    var RosterEventArgs = Matrix.Xmpp.Roster.RosterEventArgs;
    var Show = Matrix.Xmpp.Show;
    var BoshSocket = Matrix.Net.BoshSocket;
    var XmppClient = (function () {
        //constructor(username: string, password: string, xmppDomain: string, port: number);
        function XmppClient(username, password, xmppDomain) {
            var _this = this;
            // Events
            this.onReadXml = new Matrix.GenericEvent();
            this.onWriteXml = new Matrix.GenericEvent();
            this.onStreamFeatures = new Matrix.GenericEvent();
            this.onIq = new Matrix.GenericEvent();
            this.onPresence = new Matrix.GenericEvent();
            this.onMessage = new Matrix.GenericEvent();
            this.onBind = new Matrix.GenericEvent();
            this.onBindStart = new Matrix.GenericEvent();
            this.onBindError = new Matrix.GenericEvent();
            this.onLogin = new Matrix.GenericEvent();
            this.onClose = new Matrix.GenericEvent();
            this.onSessionReady = new Matrix.GenericEvent();
            this.onRosterStart = new Matrix.GenericEvent();
            this.onRosterItem = new Matrix.GenericEvent();
            this.onRosterEnd = new Matrix.GenericEvent();
            this.onSaslStart = new Matrix.GenericEvent();
            this.onError = new Matrix.GenericEvent();
            this._socket = null;
            this._resource = "MatriX.js";
            this._port = 5280;
            this._autoRoster = true;
            this._autoPresence = true;
            this._receivedOwnPresence = false;
            this._priority = 0;
            this._show = Show.None;
            this._status = null;
            this._uri = null;
            this._transport = Matrix.Transport.Websocket;
            this._xmppStreamParser = new Matrix.Xml.XmppStreamParser;
            this._streamFeatureHelper = new Matrix.StreamFeatureHelper();
            this._saslHandler = new Matrix.SaslHandler(this);
            this._iqFilter = new Matrix.IqFilter(this);
            this.bindResult = function (args) {
                var iq = args.iq;
                if (iq.type == IqType.Error) {
                    // bind error
                    _this.onBindError.trigger(new Matrix.IqEventArgs(iq));
                }
                else if (iq.type == IqType.Result) {
                    var bind = iq.elementOfType(Matrix.Xmpp.Bind.Bind);
                    if (bind != null) {
                        var jid = bind.jid;
                        _this._myJid = jid;
                        _this.onBind.trigger(new Matrix.JidEventArgs(jid));
                        _this._streamFeatureHelper.resourceBinding = true;
                    }
                }
                if (_this._streamFeatureHelper.sessionRequired) {
                    _this.requestSession();
                }
                else {
                    if (_this.autoRoster)
                        _this.requestRoster();
                    else if (_this.autoPresence)
                        _this.sendInitialPresence();
                }
            };
            this.requestSessionResult = function (args) {
                // request the roster
                if (_this.autoRoster)
                    _this.requestRoster();
                else if (_this.autoPresence)
                    _this.sendInitialPresence();
            };
            if (!Matrix.Util.Functions.isUndefined(username))
                this._username = username;
            if (!Matrix.Util.Functions.isUndefined(password))
                this._password = password;
            if (!Matrix.Util.Functions.isUndefined(xmppDomain))
                this._xmppDomain = xmppDomain;
            this.initStreamParser();
            this.initSaslHandler();
        }
        XmppClient.prototype.initSocket = function () {
            var _this = this;
            if (this.transport == Matrix.Transport.Websocket)
                this._socket = new WebSocketEx(this);
            else if (this.transport == Matrix.Transport.Bosh)
                this._socket = new BoshSocket(this);
            this._socket.xmppClient = this;
            this._socket.onConnect.on(function (args) {
                //console.log('socket connected');
                _this.sendStreamHeader();
            });
            this._socket.onDisconnect.on(function (args) {
                //console.log('socket disconnected');
                _this.onClose.trigger(args);
            });
            this._socket.onReadData.on(function (args) {
                _this.onReadXml.trigger(args);
                if (_this.transport == Matrix.Transport.Websocket) {
                    var el = XmppXElement.loadXml(args.text);
                    _this._xmppStreamParser.onStreamElement.trigger(new Matrix.StanzaEventArgs(el));
                }
                //this._xmppStreamParser.write(args.text);
            });
            this._socket.onWriteData.on(function (args) {
                _this.onWriteXml.trigger(new Matrix.TextEventArgs(args.text));
            });
            this._socket.onError.on(function (args) {
                _this.onError.trigger(args);
            });
        };
        Object.defineProperty(XmppClient.prototype, "xmppDomain", {
            get: function () { return this._xmppDomain; },
            set: function (value) { this._xmppDomain = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(XmppClient.prototype, "username", {
            get: function () { return this._username; },
            set: function (value) { this._username = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(XmppClient.prototype, "password", {
            get: function () { return this._password; },
            set: function (value) { this._password = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(XmppClient.prototype, "resource", {
            get: function () { return this._resource; },
            set: function (value) { this._resource = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(XmppClient.prototype, "port", {
            get: function () { return this._port; },
            set: function (value) { this._port = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(XmppClient.prototype, "xmppStreamParser", {
            get: function () { return this._xmppStreamParser; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(XmppClient.prototype, "iqFilter", {
            get: function () { return this._iqFilter; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(XmppClient.prototype, "autoRoster", {
            get: function () { return this._autoRoster; },
            set: function (value) { this._autoRoster = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(XmppClient.prototype, "autoPresence", {
            get: function () { return this._autoPresence; },
            set: function (value) { this._autoPresence = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(XmppClient.prototype, "priority", {
            get: function () { return this._priority; },
            set: function (value) { this._priority = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(XmppClient.prototype, "show", {
            get: function () { return this._show; },
            set: function (value) { this._show = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(XmppClient.prototype, "status", {
            get: function () { return this._status; },
            set: function (value) { this._status = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(XmppClient.prototype, "uri", {
            /* gets the websocket or bosh uri */
            get: function () { return this._uri; },
            /* sets the websocket or bosh uri */
            set: function (value) { this._uri = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(XmppClient.prototype, "transport", {
            get: function () { return this._transport; },
            set: function (value) { this._transport = value; },
            enumerable: true,
            configurable: true
        });
        XmppClient.prototype.open = function () {
            if (this._socket == null)
                this.initSocket();
            this._socket.connect();
        };
        /*
         * private triggerSendFunction() {
            setTimeout( () => {
                this.sendFunction();
            }, this.SENDFUNC_INTERVAL);
        }
         */
        XmppClient.prototype.close = function () {
            // TODO
            this.sendStreamFooter();
            //this._socket.disconnect();
        };
        XmppClient.prototype.send = function (xml) {
            this._socket.send(xml);
        };
        XmppClient.prototype.initStreamParser = function () {
            var _this = this;
            this._xmppStreamParser.onStreamStart.on(function (args) {
            });
            this._xmppStreamParser.onStreamElement.on(function (args) {
                if (args.stanza instanceof Matrix.Xmpp.Client.Message)
                    _this.onMessage.trigger(new Matrix.MessageEventArgs(args.stanza));
                else if (args.stanza instanceof Matrix.Xmpp.Client.Iq)
                    _this.processIq(args.stanza);
                else if (args.stanza instanceof Matrix.Xmpp.Client.Presence) {
                    var pres = args.stanza;
                    if (!_this._receivedOwnPresence
                        && !Matrix.Util.Functions.isUndefined(_this._myJid)
                        && pres.from.full === _this._myJid.full) {
                        _this.onSessionReady.trigger(new Matrix.EventArgs());
                        _this._receivedOwnPresence = true;
                    }
                    _this.onPresence.trigger(new Matrix.PresenceEventArgs(pres));
                }
                else if (args.stanza instanceof Matrix.Xmpp.Stream.StreamFeatures)
                    _this.processStreamFeatures(args.stanza);
            });
            this._xmppStreamParser.onStreamEnd.on(function (args) {
                //console.log("onStreamEnd");
            });
        };
        XmppClient.prototype.initSaslHandler = function () {
            var _this = this;
            this._saslHandler.onSaslStart.on(function (args) {
                _this.onSaslStart.trigger(args);
            });
            this._saslHandler.onSaslSuccess.on(function (args) {
                _this._streamFeatureHelper.sasl = true;
                // we are authenticated
                //raise OnLlogin event
                _this.onLogin.trigger(new Matrix.EventArgs());
                _this.streamReset();
            });
            this._saslHandler.onSaslFailure.on(function (args) {
            });
        };
        /// Do a stream reset
        XmppClient.prototype.streamReset = function () {
            this._xmppStreamParser.reset();
            this.sendStreamHeader();
        };
        XmppClient.prototype.sendStreamHeader = function () {
            // build the stream header
            // build the stream header
            if (this.transport == Matrix.Transport.Websocket) {
                var open = new Matrix.Xmpp.Framing.Open();
                open.version = "1.0";
                open.to = new Matrix.Jid(this.xmppDomain);
                this.send(open.toString());
            }
            else if (this.transport == Matrix.Transport.Bosh) {
                this.send(new Matrix.Xmpp.Client.Stream());
            }
        };
        XmppClient.prototype.sendStreamFooter = function () {
            // build the stream footer
            if (this.transport == Matrix.Transport.Websocket) {
                this.send(new Matrix.Xmpp.Framing.Close());
            }
            else {
                var stream = new Matrix.Xmpp.Client.Stream();
                this.send(stream.endTag());
            }
        };
        XmppClient.prototype.processIq = function (iq) {
            this.onIq.trigger(new Matrix.IqEventArgs(iq));
            var query = iq.getFirstXmppXElement();
            if (query instanceof Matrix.Xmpp.Roster.Roster)
                this.processRosterIq(iq);
        };
        XmppClient.prototype.processRosterIq = function (iq) {
            var _this = this;
            this.onIq.trigger(new Matrix.IqEventArgs(iq));
            var roster = iq.elementOfType(Matrix.Xmpp.Roster.Roster);
            var iqType = iq.type;
            if (iqType == IqType.Result)
                this.onRosterStart.trigger(new Matrix.EventArgs());
            roster.getRoster().forEach(function (ri) { return _this.onRosterItem.trigger(new RosterEventArgs(ri, roster.version)); });
            if (iqType == IqType.Result)
                this.onRosterEnd.trigger(new Matrix.EventArgs());
            // acknowledge roster pushes
            if (iqType == IqType.Set) {
                var ack = new Iq();
                ack.type = IqType.Result;
                ack.id = iq.id;
                this.send(ack);
            }
            if (iqType == IqType.Result && this.autoPresence)
                this.sendInitialPresence();
        };
        XmppClient.prototype.processStreamFeatures = function (features) {
            /*
                 XEP-0170
                 1. TLS
                 2. SASL
                      2.1 Stream Management
                 3. Stream compression
                 4. Resource binding
              */
            // trigger event
            this.onStreamFeatures.trigger(new Matrix.StanzaEventArgs(features));
            //if (!IsAuthenticated && RegisterNewAccount && features.SupportsRegistration) {
            //    GetRegistrationInformation(features);
            //}
            if (!this._streamFeatureHelper.sasl) {
                //    // Do Sasl authentication
                this._saslHandler.startSasl(features);
            }
            else if (!this._streamFeatureHelper.resourceBinding) {
                if (features.supportsSession)
                    this._streamFeatureHelper.sessionRequired = true;
                if (features.supportsBind)
                    this.bindResource();
            }
        };
        XmppClient.prototype.bindResource = function () {
            /*
             SENT: <iq id="jcl_1" type="set">
                        ns="urn:ietf:params:xml:ns:xmpp-bind">
                            <resource>Exodus</resource>
                        </bind>
                   </iq>
         
             RECV: <iq id='jcl_1' type='result'>
                        ns='urn:ietf:params:xml:ns:xmpp-bind'>
                            <jid>gnauck@jabber.ru/Exodus</jid>
                        </bind>
                 
            */
            var bIq = new IqQuery(Matrix.Xmpp.Bind.Bind);
            bIq.generateId();
            bIq.type = IqType.Set;
            bIq.query.resource = this.resource;
            // oovoo wants to send additional data with the bind request, so we have added 
            // this event for them. Maybe its useful for other customers as well.
            this.onBindStart.trigger(new Matrix.IqEventArgs(bIq));
            this.iqFilter.sendIq(bIq, this.bindResult);
        };
        XmppClient.prototype.requestRoster = function (version) {
            if (version === void 0) { version = null; }
            var riq = new IqQuery(Matrix.Xmpp.Roster.Roster);
            riq.generateId();
            riq.type = IqType.Get;
            if (version != null)
                riq.query.version = version;
            this.send(riq);
        };
        XmppClient.prototype.requestSession = function () {
            var sIq = new IqQuery(Matrix.Xmpp.Session.Session);
            sIq.generateId();
            sIq.type = IqType.Set;
            this.iqFilter.sendIq(sIq, this.requestSessionResult);
        };
        XmppClient.prototype.sendInitialPresence = function () {
            this.sendPresence();
        };
        XmppClient.prototype.sendPresence = function (show, status, priority) {
            // set new property values when given
            if (typeof show !== 'undefined')
                this.show = show;
            if (!Matrix.Util.Functions.isUndefined(status))
                this.status = status;
            if (!Matrix.Util.Functions.isUndefined(priority))
                this.priority = priority;
            // build and send the presence packet
            var pres = new Matrix.Xmpp.Client.Presence();
            pres.show = this.show;
            pres.priority = this.priority;
            if (this.status != null)
                pres.status = this.status;
            this.send(pres);
        };
        return XmppClient;
    })();
    Matrix.XmppClient = XmppClient;
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="Xmpp/IqType.ts" />
/// <reference path="IqEventArgs.ts" />
/// <reference path="Collections/Collections.ts" />
/// <reference path="XmppClient.ts" />
var Matrix;
(function (Matrix) {
    "use strict";
    var Dictionary = Matrix.Collections.Dictionary;
    var IqFilter = (function () {
        function IqFilter(xmppClient) {
            var _this = this;
            this._dictFilter = new Dictionary();
            this.iqHandler = function (args) {
                var iq = args.iq;
                if (iq == null)
                    return;
                //iq response MUST be always either of type result or error
                if (iq.type != Matrix.Xmpp.IqType.Error && iq.type != Matrix.Xmpp.IqType.Result)
                    return;
                var id = iq.id;
                if (!id)
                    return;
                if (!_this._dictFilter.containsKey(id))
                    return;
                var filteData = _this._dictFilter.getValue(id);
                _this._dictFilter.remove(id);
                var iqEventArg = new Matrix.IqEventArgs(iq);
                iqEventArg.state = filteData.state;
                filteData.iqCallback(iqEventArg);
            };
            this._xmppClient = xmppClient;
            this._xmppClient.onIq.on(this.iqHandler);
        }
        IqFilter.prototype.sendIq = function (iq, callback, state) {
            // check if the callback is null, in case of wrong usage of this class
            if (callback != null) {
                var fd = new Matrix.FilterData(callback, state);
                this._dictFilter.setValue(iq.id, fd);
            }
            this._xmppClient.send(iq);
        };
        return IqFilter;
    })();
    Matrix.IqFilter = IqFilter;
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        "use strict";
        (function (MessageType) {
            MessageType[MessageType["Normal"] = -1] = "Normal";
            MessageType[MessageType["Error"] = 0] = "Error";
            MessageType[MessageType["Chat"] = 1] = "Chat";
            MessageType[MessageType["GroupChat"] = 2] = "GroupChat";
            MessageType[MessageType["Headline"] = 3] = "Headline";
        })(Xmpp.MessageType || (Xmpp.MessageType = {}));
        var MessageType = Xmpp.MessageType;
        Object.freeze(MessageType);
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="XmppXElementWithAddressAndId.ts" />
/// <reference path="../MessageType.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Base;
        (function (Base) {
            "use strict";
            var Message = (function (_super) {
                __extends(Message, _super);
                function Message(ns) {
                    _super.call(this, ns, "message");
                }
                Object.defineProperty(Message.prototype, "type", {
                    get: function () {
                        return this.getAttributeEnum("type", Xmpp.MessageType);
                    },
                    set: function (value) {
                        if (value === Xmpp.MessageType.Normal)
                            this.removeAttribute("type");
                        this.setAttributeEnum("type", Xmpp.MessageType, value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Message.prototype, "body", {
                    get: function () {
                        return this.getTag("body");
                    },
                    set: function (value) {
                        this.setTag("body", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Message.prototype, "subject", {
                    get: function () {
                        return this.getTag("subject");
                    },
                    set: function (value) {
                        this.setTag("subject", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Message.prototype, "delay", {
                    get: function () {
                        return this.elementOfType(Xmpp.Delay.Delay);
                    },
                    set: function (value) {
                        this.replace(Xmpp.Delay.Delay, value);
                    },
                    enumerable: true,
                    configurable: true
                });
                return Message;
            })(Base.XmppXElementWithAddressAndId);
            Base.Message = Message;
        })(Base = Xmpp.Base || (Xmpp.Base = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Base/Message.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Client;
        (function (Client) {
            "use strict";
            var Message = (function (_super) {
                __extends(Message, _super);
                function Message() {
                    _super.call(this, Matrix.Namespaces.client);
                }
                return Message;
            })(Xmpp.Base.Message);
            Client.Message = Message;
        })(Client = Xmpp.Client || (Xmpp.Client = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="EventArgs.ts" />
/// <reference path="Xmpp/Client/Message.ts" />
var Matrix;
(function (Matrix) {
    "use strict";
    var MessageEventArgs = (function (_super) {
        __extends(MessageEventArgs, _super);
        function MessageEventArgs(message) {
            _super.call(this);
            this.message = message;
        }
        Object.defineProperty(MessageEventArgs.prototype, "message", {
            get: function () { return this._message; },
            set: function (value) { this._message = value; },
            enumerable: true,
            configurable: true
        });
        return MessageEventArgs;
    })(Matrix.EventArgs);
    Matrix.MessageEventArgs = MessageEventArgs;
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="EventArgs.ts" />
/// <reference path="Xmpp/Client/Presence.ts" />
var Matrix;
(function (Matrix) {
    "use strict";
    var PresenceEventArgs = (function (_super) {
        __extends(PresenceEventArgs, _super);
        function PresenceEventArgs(presence) {
            _super.call(this);
            this.presence = presence;
        }
        Object.defineProperty(PresenceEventArgs.prototype, "presence", {
            get: function () { return this._presence; },
            set: function (value) { this._presence = value; },
            enumerable: true,
            configurable: true
        });
        return PresenceEventArgs;
    })(Matrix.EventArgs);
    Matrix.PresenceEventArgs = PresenceEventArgs;
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../xml/XmppXElement.ts" />
/// <reference path="../../Sasl/SaslMechanism.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Sasl;
        (function (Sasl) {
            "use strict";
            var XmppXElement = Matrix.Xml.XmppXElement;
            var Mechanism = (function (_super) {
                __extends(Mechanism, _super);
                function Mechanism() {
                    _super.call(this, Matrix.Namespaces.sasl, "mechanism");
                }
                Object.defineProperty(Mechanism.prototype, "saslMechanism", {
                    get: function () {
                        return Matrix.Sasl.saslMechanismNameToEnum(this.value);
                    },
                    set: function (value) {
                        this.value = Matrix.Sasl.enumToSaslMechanismName(value);
                    },
                    enumerable: true,
                    configurable: true
                });
                return Mechanism;
            })(XmppXElement);
            Sasl.Mechanism = Mechanism;
        })(Sasl = Xmpp.Sasl || (Xmpp.Sasl = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../util/base64.ts" />
/// <reference path="../typings/ltxml.d.ts" />
/// <reference path="../xmpp/sasl/auth.ts" />
/// <reference path="saslprocessor.ts" />
var Matrix;
(function (Matrix) {
    var Sasl;
    (function (Sasl) {
        "use strict";
        var Auth = Matrix.Xmpp.Sasl.Auth;
        var PlainProcessor = (function (_super) {
            __extends(PlainProcessor, _super);
            function PlainProcessor() {
                _super.apply(this, arguments);
            }
            PlainProcessor.prototype.init = function (xmppClient) {
                _super.prototype.init.call(this, xmppClient);
                xmppClient.send(new Auth(Sasl.SaslMechanism.Plain, this.getMessage()));
            };
            PlainProcessor.prototype.getMessage = function () {
                // NULL Username NULL Password
                var str = "";
                str = str + "\u0000";
                str = str + this.xmppClient.username;
                str = str + "\u0000";
                str = str + this.xmppClient.password;
                return Matrix.Util.Base64.encode(str);
            };
            return PlainProcessor;
        })(Sasl.SaslProcessor);
        Sasl.PlainProcessor = PlainProcessor;
    })(Sasl = Matrix.Sasl || (Matrix.Sasl = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../crypt/randomnumbergenerator.ts" />
var Matrix;
(function (Matrix) {
    var Sasl;
    (function (Sasl) {
        var Digest;
        (function (Digest) {
            "use strict";
            var Step2 = (function () {
                function Step2(step1, proc) {
                    this._step1 = step1;
                    this._proc = proc;
                    // fixed for SASL in amessage servers (jabberd 1.x)
                    //if (SupportsAuth(step1.Qop))
                    //    _step1.Qop = "auth";
                    this.generateCnonce();
                    this.generateNc();
                    this.generateDigestUri();
                    this.generateResponse();
                }
                Object.defineProperty(Step2.prototype, "cnonce", {
                    get: function () { return this._Cnonce; },
                    set: function (value) { this._Cnonce = value; },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Step2.prototype, "nc", {
                    get: function () { return this._Nc; },
                    set: function (value) { this._Nc = value; },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Step2.prototype, "digestUri", {
                    get: function () { return this._DigestUri; },
                    set: function (value) { this._DigestUri = value; },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Step2.prototype, "response", {
                    get: function () { return this._Response; },
                    set: function (value) { this._Response = value; },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Step2.prototype, "authzid", {
                    get: function () { return this._Authzid; },
                    set: function (value) { this._Authzid = value; },
                    enumerable: true,
                    configurable: true
                });
                Step2.prototype.getMessage = function () {
                    return this.generateMessage();
                };
                Step2.prototype.generateCnonce = function () {
                    // Lenght of the Session ID on bytes,
                    // 32 bytes equaly 64 chars
                    // 16^64 possibilites for the session IDs (4.294.967.296)
                    // This should be unique enough
                    var lenght = 32;
                    var rng = Matrix.Crypt.RandomNumberGenerator.create();
                    var buf = new Array(lenght);
                    rng.getBytes(buf);
                    this.cnonce = Matrix.Util.Functions.hexToString(buf).toLowerCase();
                    //#if TEST
                    //    m_Cnonce = "28f47432f9606887d9b727e65db225eb7cb4b78073d8b6f32399400e01438f1e";
                    //#endif
                };
                Step2.prototype.generateNc = function () {
                    this.nc = "00000001";
                };
                Step2.prototype.generateDigestUri = function () {
                    this.digestUri = "xmpp/" + this._proc.server;
                };
                Step2.prototype.generateResponse = function () {
                    var H1;
                    var H2;
                    var H3;
                    var A1;
                    var A2;
                    var A3;
                    var s = "";
                    s += this._proc.username;
                    s += ":";
                    s += this._step1.realm;
                    s += ":";
                    s += this._proc.password;
                    H1 = Matrix.Crypt.MD5.hash(s);
                    //reset s
                    s = "";
                    s += ":";
                    s += this._step1.nonce;
                    s += ":";
                    s += this.cnonce;
                    if (this.authzid != null) {
                        s += ":";
                        s += this.authzid;
                    }
                    A1 = s;
                    var H1A1 = H1 + A1;
                    H1 = Matrix.Crypt.MD5.hexdigest(H1A1);
                    s = "";
                    s += "AUTHENTICATE:";
                    s += this.digestUri;
                    if (this._step1.qop !== "auth") {
                        s += ":00000000000000000000000000000000";
                    }
                    A2 = s;
                    H2 = Matrix.Crypt.MD5.hexdigest(A2);
                    s = "";
                    s += H1;
                    s += ":";
                    s += this._step1.nonce;
                    s += ":";
                    s += this.nc;
                    s += ":";
                    s += this.cnonce;
                    s += ":";
                    s += this._step1.qop;
                    s += ":";
                    s += H2;
                    A3 = s;
                    H3 = Matrix.Crypt.MD5.hexdigest(A3);
                    this.response = H3;
                };
                Step2.prototype.generateMessage = function () {
                    var s = "";
                    s += "username=";
                    s += this.addQuotes(this._proc.username);
                    s += ",";
                    s += "realm=";
                    s += this.addQuotes(this._step1.realm);
                    s += ",";
                    s += "nonce=";
                    s += this.addQuotes(this._step1.nonce);
                    s += ",";
                    s += "cnonce=";
                    s += this.addQuotes(this.cnonce);
                    s += ",";
                    s += "nc=";
                    s += this.nc;
                    s += ",";
                    s += "qop=";
                    s += this._step1.qop;
                    s += ",";
                    s += "digest-uri=";
                    s += this.addQuotes(this.digestUri);
                    s += ",";
                    s += "charset=";
                    s += this._step1.charset;
                    s += ",";
                    s += "response=";
                    s += this.response;
                    return s;
                };
                /// <summary>
                /// return the given string with quotes
                /// </summary>
                /// <param name="s"></param>
                /// <returns></returns>
                Step2.prototype.addQuotes = function (s) {
                    // fixed, s can be null (eg. for realm in ejabberd)
                    if (s != null && s.length > 0)
                        s = s.replace("\\", "\\\\");
                    var quote = "\"";
                    return quote + s + quote;
                };
                return Step2;
            })();
            Digest.Step2 = Step2;
        })(Digest = Sasl.Digest || (Sasl.Digest = {}));
    })(Sasl = Matrix.Sasl || (Matrix.Sasl = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    var Sasl;
    (function (Sasl) {
        var Digest;
        (function (Digest) {
            "use strict";
            var Step1 = (function () {
                function Step1(s) {
                    this._Realm = "";
                    this._Charset = "utf-8";
                    this._Rspauth = null;
                    this.parse(s);
                }
                Object.defineProperty(Step1.prototype, "realm", {
                    get: function () { return this._Realm; },
                    set: function (value) { this._Realm = value; },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Step1.prototype, "nonce", {
                    get: function () { return this._Nonce; },
                    set: function (value) { this._Nonce = value; },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Step1.prototype, "qop", {
                    get: function () { return this._Qop; },
                    set: function (value) { this._Qop = value; },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Step1.prototype, "charset", {
                    get: function () { return this._Charset; },
                    set: function (value) { this._Charset = value; },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Step1.prototype, "algorithm", {
                    get: function () { return this._Algorithm; },
                    set: function (value) { this._Algorithm = value; },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Step1.prototype, "rspauth", {
                    get: function () { return this._Rspauth; },
                    set: function (value) { this._Rspauth = value; },
                    enumerable: true,
                    configurable: true
                });
                /*
                    nonce="deqOGux/N6hDPtf9vkGMU5Vzae+zfrqpBIvh6LovbBM=",
                    realm="amessage.de",
                    qop="auth,auth-int,auth-conf",
                    cipher="rc4-40,rc4-56,rc4,des,3des",
                    maxbuf=1024,
                    charset=utf-8,
                    algorithm=md5-sess
                */
                Step1.prototype.parse = function (message) {
                    try {
                        var start = 0;
                        while (start < message.length) {
                            var equalPos = message.indexOf('=', start);
                            if (equalPos > 0) {
                                // look if the next char is a quote
                                var end;
                                if (message.substr(equalPos + 1, 1) === "\"") {
                                    // quoted value, find the end now
                                    end = message.indexOf('"', equalPos + 2);
                                    this.parsePair(message.substr(start, end - start + 1));
                                    start = end + 2;
                                }
                                else {
                                    // value is not quoted, ends at the next comma or end of string   
                                    end = message.indexOf(',', equalPos + 1);
                                    if (end === -1)
                                        end = message.length;
                                    this.parsePair(message.substr(start, end - start));
                                    start = end + 1;
                                }
                            }
                        }
                    }
                    catch (e) {
                    }
                };
                Step1.prototype.parsePair = function (pair) {
                    var equalPos = pair.indexOf("=");
                    if (equalPos > 0) {
                        var key = pair.substr(0, equalPos);
                        // is the value quoted?
                        var data = pair.substr(equalPos + 1, 1) === "\""
                            ? pair.substr(equalPos + 2, pair.length - equalPos - 3)
                            : pair.substr(equalPos + 1);
                        switch (key) {
                            case "realm":
                                this.realm = data;
                                break;
                            case "nonce":
                                this.nonce = data;
                                break;
                            case "qop":
                                this.qop = data;
                                break;
                            case "charset":
                                this.charset = data;
                                break;
                            case "algorithm":
                                this.algorithm = data;
                                break;
                            case "rspauth":
                                this.rspauth = data;
                                break;
                        }
                    }
                };
                return Step1;
            })();
            Digest.Step1 = Step1;
        })(Digest = Sasl.Digest || (Sasl.Digest = {}));
    })(Sasl = Matrix.Sasl || (Matrix.Sasl = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Base/Sasl.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Sasl;
        (function (Sasl) {
            "use strict";
            var Challenge = (function (_super) {
                __extends(Challenge, _super);
                function Challenge() {
                    _super.call(this, "challenge");
                }
                return Challenge;
            })(Xmpp.Base.Sasl);
            Sasl.Challenge = Challenge;
        })(Sasl = Xmpp.Sasl || (Xmpp.Sasl = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../Collections/Collections.ts" />
/// <reference path="../../Util/Functions.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Sasl;
        (function (Sasl) {
            "use strict";
            var Response = (function (_super) {
                __extends(Response, _super);
                function Response(value) {
                    _super.call(this, "response");
                    if (!Matrix.Util.Functions.isUndefined(value))
                        this.value = value;
                }
                return Response;
            })(Xmpp.Base.Sasl);
            Sasl.Response = Response;
        })(Sasl = Xmpp.Sasl || (Xmpp.Sasl = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../util/base64.ts" />
/// <reference path="digest/step2.ts" />
/// <reference path="digest/step1.ts" />
/// <reference path="saslprocessor.ts" />
/// <reference path="../xmpp/sasl/challenge.ts" />
/// <reference path="../xmpp/sasl/auth.ts" />
/// <reference path="../xmpp/sasl/response.ts" />
var Matrix;
(function (Matrix) {
    var Sasl;
    (function (Sasl) {
        "use strict";
        var Base64 = Matrix.Util.Base64;
        var Auth = Matrix.Xmpp.Sasl.Auth;
        var Response = Matrix.Xmpp.Sasl.Response;
        var Step1 = Matrix.Sasl.Digest.Step1;
        var Step2 = Matrix.Sasl.Digest.Step2;
        var DigestMD5Processor = (function (_super) {
            __extends(DigestMD5Processor, _super);
            function DigestMD5Processor() {
                _super.apply(this, arguments);
            }
            DigestMD5Processor.prototype.init = function (xmppClient) {
                _super.prototype.init.call(this, xmppClient);
                xmppClient.send(new Auth(Sasl.SaslMechanism.DigestMd5));
            };
            DigestMD5Processor.prototype.parse = function (ch) {
                var step1 = new Step1(Base64.decode(ch.value));
                if (step1.rspauth == null) {
                    var s2 = new Step2(step1, this);
                    var message = s2.getMessage();
                    this.xmppClient.send(new Response(Base64.encode(message)));
                }
                else {
                    this.xmppClient.send(new Response());
                }
            };
            return DigestMD5Processor;
        })(Sasl.SaslProcessor);
        Sasl.DigestMD5Processor = DigestMD5Processor;
    })(Sasl = Matrix.Sasl || (Matrix.Sasl = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
// based on:
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */
var Matrix;
(function (Matrix) {
    var Crypt;
    (function (Crypt) {
        var SHA1;
        (function (SHA1) {
            "use strict";
            /*
             * Calculate the SHA-1 of an array of big-endian words, and a bit length
             */
            function core_sha1(x, len) {
                /* append padding */
                x[len >> 5] |= 0x80 << (24 - len % 32);
                x[((len + 64 >> 9) << 4) + 15] = len;
                var w = new Array(80);
                var a = 1732584193;
                var b = -271733879;
                var c = -1732584194;
                var d = 271733878;
                var e = -1009589776;
                var i, j, t, olda, oldb, oldc, oldd, olde;
                for (i = 0; i < x.length; i += 16) {
                    olda = a;
                    oldb = b;
                    oldc = c;
                    oldd = d;
                    olde = e;
                    for (j = 0; j < 80; j++) {
                        if (j < 16) {
                            w[j] = x[i + j];
                        }
                        else {
                            w[j] = rol(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
                        }
                        t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)), safe_add(safe_add(e, w[j]), sha1_kt(j)));
                        e = d;
                        d = c;
                        c = rol(b, 30);
                        b = a;
                        a = t;
                    }
                    a = safe_add(a, olda);
                    b = safe_add(b, oldb);
                    c = safe_add(c, oldc);
                    d = safe_add(d, oldd);
                    e = safe_add(e, olde);
                }
                return [a, b, c, d, e];
            }
            /*
             * Perform the appropriate triplet combination function for the current
             * iteration
             */
            function sha1_ft(t, b, c, d) {
                if (t < 20) {
                    return (b & c) | ((~b) & d);
                }
                if (t < 40) {
                    return b ^ c ^ d;
                }
                if (t < 60) {
                    return (b & c) | (b & d) | (c & d);
                }
                return b ^ c ^ d;
            }
            /*
             * Determine the appropriate additive constant for the current iteration
             */
            function sha1_kt(t) {
                return (t < 20) ? 1518500249 : (t < 40) ? 1859775393 :
                    (t < 60) ? -1894007588 : -899497514;
            }
            /*
             * Calculate the HMAC-SHA1 of a key and some data
             */
            function core_hmac_sha1(key, data) {
                var bkey = str2binb(key);
                if (bkey.length > 16) {
                    bkey = core_sha1(bkey, key.length * 8);
                }
                var ipad = new Array(16), opad = new Array(16);
                for (var i = 0; i < 16; i++) {
                    ipad[i] = bkey[i] ^ 0x36363636;
                    opad[i] = bkey[i] ^ 0x5C5C5C5C;
                }
                var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * 8);
                return core_sha1(opad.concat(hash), 512 + 160);
            }
            SHA1.core_hmac_sha1 = core_hmac_sha1;
            /*
             * Add integers, wrapping at 2^32. This uses 16-bit operations internally
             * to work around bugs in some JS interpreters.
             */
            function safe_add(x, y) {
                var lsw = (x & 0xFFFF) + (y & 0xFFFF);
                var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
                return (msw << 16) | (lsw & 0xFFFF);
            }
            /*
             * Bitwise rotate a 32-bit number to the left.
             */
            function rol(num, cnt) {
                return (num << cnt) | (num >>> (32 - cnt));
            }
            /*
             * Convert an 8-bit or 16-bit string to an array of big-endian words
             * In 8-bit function, characters >255 have their hi-byte silently ignored.
             */
            function str2binb(str) {
                var bin = [];
                var mask = 255;
                for (var i = 0; i < str.length * 8; i += 8) {
                    bin[i >> 5] |= (str.charCodeAt(i / 8) & mask) << (24 - i % 32);
                }
                return bin;
            }
            /*
             * Convert an array of big-endian words to a string
             */
            function binb2str(bin) {
                var str = "";
                var mask = 255;
                for (var i = 0; i < bin.length * 32; i += 8) {
                    str += String.fromCharCode((bin[i >> 5] >>> (24 - i % 32)) & mask);
                }
                return str;
            }
            SHA1.binb2str = binb2str;
            /*
             * Convert an array of big-endian words to a base-64 string
             */
            function binb2b64(binarray) {
                var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                var str = "";
                var triplet, j;
                for (var i = 0; i < binarray.length * 4; i += 3) {
                    triplet = (((binarray[i >> 2] >> 8 * (3 - i % 4)) & 0xFF) << 16) |
                        (((binarray[i + 1 >> 2] >> 8 * (3 - (i + 1) % 4)) & 0xFF) << 8) |
                        ((binarray[i + 2 >> 2] >> 8 * (3 - (i + 2) % 4)) & 0xFF);
                    for (j = 0; j < 4; j++) {
                        if (i * 8 + j * 6 > binarray.length * 32) {
                            str += "=";
                        }
                        else {
                            str += tab.charAt((triplet >> 6 * (3 - j)) & 0x3F);
                        }
                    }
                }
                return str;
            }
            /*
            * These are the functions you'll usually want to call
            * They take string arguments and return either hex or base-64 encoded strings
            */
            function b64_hmac_sha1(key, data) {
                return binb2b64(core_hmac_sha1(key, data));
            }
            SHA1.b64_hmac_sha1 = b64_hmac_sha1;
            function b64_sha1(s) {
                return binb2b64(core_sha1(str2binb(s), s.length * 8));
            }
            SHA1.b64_sha1 = b64_sha1;
            function str_hmac_sha1(key, data) {
                return binb2str(core_hmac_sha1(key, data));
            }
            SHA1.str_hmac_sha1 = str_hmac_sha1;
            function str_sha1(s) {
                return binb2str(core_sha1(str2binb(s), s.length * 8));
            }
            SHA1.str_sha1 = str_sha1;
        })(SHA1 = Crypt.SHA1 || (Crypt.SHA1 = {}));
    })(Crypt = Matrix.Crypt || (Matrix.Crypt = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../crypt/sha1.ts" />
/// <reference path="../../crypt/randomnumbergenerator.ts" />
/// <reference path="../../util/base64.ts" />
/// <reference path="../../collections/collections.ts" />
var Matrix;
(function (Matrix) {
    var Sasl;
    (function (Sasl) {
        var Scram;
        (function (Scram) {
            "use strict";
            var Dictionary = Matrix.Collections.Dictionary;
            var RandomNumberGenerator = Matrix.Crypt.RandomNumberGenerator;
            var Base64 = Matrix.Util.Base64;
            var Sha1 = Matrix.Crypt.SHA1;
            var ScramHelper = (function () {
                function ScramHelper() {
                    this.LENGHT_CLIENT_NONCE = 24;
                    this.LENGHT_SERVER_NONCE = 24;
                    this.LENGHT_SALT = 20;
                    this.DEFAULT_ITERATION_COUNT = 4096;
                }
                ScramHelper.prototype.generateSalt = function () {
                    return RandomNumberGenerator.create().getString(this.LENGHT_SALT);
                };
                /// <summary>
                /// Generate a random client nonce
                /// </summary>
                ScramHelper.prototype.generateClientNonce = function () {
                    var random = RandomNumberGenerator.create().getString(this.LENGHT_CLIENT_NONCE);
                    return Base64.encode(random);
                };
                ScramHelper.prototype.generateServerNonce = function () {
                    var random = RandomNumberGenerator.create().getString(this.LENGHT_SERVER_NONCE);
                    return Base64.decode(random);
                };
                ScramHelper.prototype.parseMessage = function (msg) {
                    var str = msg.split(',');
                    var dict = new Dictionary();
                    str.forEach(function (s) {
                        var equalPos = s.indexOf("=");
                        if (equalPos !== -1) {
                            var key = s.substr(0, equalPos - 0);
                            var val = s.substr(equalPos + 1);
                            if (!dict.containsKey(key))
                                dict.setValue(key, val);
                        }
                    });
                    return dict;
                };
                ScramHelper.prototype.hi = function (pass, salt, iterations) {
                    var ssalt = salt + "\x00\x00\x00\x01";
                    var U, U_old;
                    var Hi = U_old = Sha1.core_hmac_sha1(pass, ssalt);
                    for (var i = 1; i < iterations; i++) {
                        U = Sha1.core_hmac_sha1(pass, Sha1.binb2str(U_old));
                        for (var j = 0; j < 5; j++) {
                            Hi[j] ^= U[j];
                        }
                        U_old = U;
                    }
                    return Sha1.binb2str(Hi);
                };
                ScramHelper.prototype.generateFirstClientMessage = function (user) {
                    this.clientNonceB64 = this.generateClientNonce();
                    var s = "";
                    ;
                    // no channel bindings supported
                    s += "n,,";
                    // username
                    s += "n=";
                    s += this.escapeUsername(user);
                    s += ",";
                    // client nonce
                    s += "r=";
                    s += this.clientNonceB64;
                    this.firstClientMessage = s;
                    return s;
                };
                ScramHelper.prototype.generateFinalClientMessage = function (sMessage, password) {
                    var pairs = this.parseMessage(sMessage);
                    //string clientServerNonce = pairs["r"];
                    var serverNonce = pairs.getValue("r").substring(this.clientNonceB64.length);
                    var salt = pairs.getValue("s"); // the user's salt - (base64 encoded)
                    salt = Base64.decode(salt);
                    var iteration = parseInt(pairs.getValue("i")); // iteation count
                    // the bare of our first message
                    var clientFirstMessageBare = this.firstClientMessage.substring(3);
                    var sb = "";
                    sb += "c=biws,";
                    // Client/Server nonce
                    sb += "r=";
                    sb += this.clientNonceB64;
                    sb += serverNonce;
                    var clientFinalMessageWithoutProof = sb;
                    var authMessage = clientFirstMessageBare + "," + sMessage + "," + clientFinalMessageWithoutProof;
                    var saltedPassword = this.hi(password, salt, iteration);
                    var clientKey = Sha1.core_hmac_sha1(saltedPassword, "Client Key");
                    var storedKey = Sha1.str_sha1(Sha1.binb2str(clientKey));
                    var clientSignature = Sha1.core_hmac_sha1(storedKey, authMessage);
                    var clientProof = Sha1.binb2str(this.binaryXor(clientKey, clientSignature));
                    var clientFinalMessage = clientFinalMessageWithoutProof;
                    clientFinalMessage += ",p=";
                    clientFinalMessage += Base64.encode(clientProof);
                    return clientFinalMessage;
                };
                /* binary XOR function */
                ScramHelper.prototype.binaryXor = function (b1, b2) {
                    var result = Array(b1.length);
                    for (var k = 0; k < 5; k++) {
                        result[k] = b1[k] ^ b2[k];
                    }
                    return result;
                };
                ScramHelper.prototype.escapeUsername = function (user) {
                    /*
                    The characters ',' or '=' in usernames are sent as '=2C' and
                    '=3D' respectively.  If the server receives a username that
                    contains '=' not followed by either '2C' or '3D', then the
                    server MUST fail the authentication.
                    */
                    var ret = user.replace(",", "=2C");
                    ret = ret.replace("=", "=3D");
                    return ret;
                };
                return ScramHelper;
            })();
            Scram.ScramHelper = ScramHelper;
        })(Scram = Sasl.Scram || (Sasl.Scram = {}));
    })(Sasl = Matrix.Sasl || (Matrix.Sasl = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../xmpp/sasl/response.ts" />
/// <reference path="../util/base64.ts" />
/// <reference path="scram/scramhelper.ts" />
/// <reference path="../xmpp/sasl/auth.ts" />
/// <reference path="../xmpp/sasl/challenge.ts" />
var Matrix;
(function (Matrix) {
    var Sasl;
    (function (Sasl) {
        "use strict";
        var Auth = Matrix.Xmpp.Sasl.Auth;
        var ScramHelper = Matrix.Sasl.Scram.ScramHelper;
        var Base64 = Matrix.Util.Base64;
        var Response = Matrix.Xmpp.Sasl.Response;
        var ScramProcessor = (function (_super) {
            __extends(ScramProcessor, _super);
            function ScramProcessor() {
                _super.apply(this, arguments);
            }
            ScramProcessor.prototype.init = function (xmppClient) {
                _super.prototype.init.call(this, xmppClient);
                this.scramHelper = new ScramHelper();
                var msg = Base64.encode(this.scramHelper.generateFirstClientMessage(this.username));
                this.xmppClient.send(new Auth(Sasl.SaslMechanism.ScramSha1, msg));
            };
            ScramProcessor.prototype.parse = function (ch) {
                var firstServerMessage = ch.getValueFromBase64();
                var clientFinalMessage = this.scramHelper.generateFinalClientMessage(firstServerMessage, this.password);
                this.xmppClient.send(new Response(Base64.encode(clientFinalMessage)));
            };
            return ScramProcessor;
        })(Sasl.SaslProcessor);
        Sasl.ScramProcessor = ScramProcessor;
    })(Sasl = Matrix.Sasl || (Matrix.Sasl = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="saslmechanism.ts" />
/// <reference path="plainprocessor.ts" />
/// <reference path="digestmd5processor.ts" />
/// <reference path="scramprocessor.ts" />
var Matrix;
(function (Matrix) {
    var Sasl;
    (function (Sasl) {
        var SaslFactory;
        (function (SaslFactory) {
            "use strict";
            function create(mech) {
                if (mech === Sasl.SaslMechanism.Plain)
                    return new Sasl.PlainProcessor();
                if (mech === Sasl.SaslMechanism.DigestMd5)
                    return new Sasl.DigestMD5Processor();
                if (mech === Sasl.SaslMechanism.ScramSha1)
                    return new Sasl.ScramProcessor();
                return null;
            }
            SaslFactory.create = create;
        })(SaslFactory = Sasl.SaslFactory || (Sasl.SaslFactory = {}));
    })(Sasl = Matrix.Sasl || (Matrix.Sasl = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Base/Sasl.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Sasl;
        (function (Sasl) {
            "use strict";
            var Success = (function (_super) {
                __extends(Success, _super);
                function Success() {
                    _super.call(this, "success");
                }
                return Success;
            })(Xmpp.Base.Sasl);
            Sasl.Success = Success;
        })(Sasl = Xmpp.Sasl || (Xmpp.Sasl = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../Xml/XmppXElement.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Sasl;
        (function (Sasl) {
            "use strict";
            var XmppXElement = Matrix.Xml.XmppXElement;
            var Failure = (function (_super) {
                __extends(Failure, _super);
                function Failure() {
                    _super.call(this, Matrix.Namespaces.sasl, "failure");
                }
                return Failure;
            })(XmppXElement);
            Sasl.Failure = Failure;
        })(Sasl = Xmpp.Sasl || (Xmpp.Sasl = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="xmpp/sasl/mechanism.ts" />
/// <reference path="sasl/saslprocessor.ts" />
/// <reference path="xmpp/sasl/sasleventargs.ts" />
/// <reference path="sasl/saslfactory.ts" />
/// <reference path="xmpp/sasl/success.ts" />
/// <reference path="xmpp/sasl/failure.ts" />
var Matrix;
(function (Matrix) {
    "use strict";
    var SaslEventArgs = Matrix.Xmpp.Sasl.SaslEventArgs;
    var SaslFactory = Matrix.Sasl.SaslFactory;
    var Challenge = Matrix.Xmpp.Sasl.Challenge;
    var Success = Matrix.Xmpp.Sasl.Success;
    var Failure = Matrix.Xmpp.Sasl.Failure;
    var SaslMechanismPriorities = Matrix.Sasl.saslMechanismPriorities;
    var SaslHandler = (function () {
        function SaslHandler(xmppClient) {
            var _this = this;
            // Events
            this.onSaslStart = new Matrix.GenericEvent();
            this.onSaslSuccess = new Matrix.GenericEvent();
            this.onSaslFailure = new Matrix.GenericEvent();
            this.streamElementHandler = function (args) {
                var el = args.stanza;
                if (el instanceof Success) {
                    _this.endSasl();
                    _this.onSaslSuccess.trigger(new Matrix.EventArgs());
                }
                else if (el instanceof Failure) {
                    _this.endSasl();
                    _this.onSaslFailure.trigger(new SaslEventArgs(el));
                }
                else if (el instanceof Challenge) {
                    if (_this._saslProc != null)
                        _this._saslProc.parse(el);
                }
            };
            this._xmppClient = xmppClient;
        }
        SaslHandler.prototype.startSasl = function (features) {
            var mechanisms = features.mechanisms;
            this._xmppClient.xmppStreamParser.onStreamElement.on(this.streamElementHandler);
            var saslArgs = new SaslEventArgs();
            saslArgs.auto = true;
            saslArgs.mechanisms = mechanisms;
            // pass XmppClient object to sender in event args
            this.onSaslStart.trigger(saslArgs);
            if (saslArgs.auto)
                this._saslProc = this.selectSaslMechanism(mechanisms);
            else {
                if (!Matrix.Util.Functions.isUndefined(saslArgs.customSaslProcessor))
                    this._saslProc = saslArgs.customSaslProcessor;
                else
                    this._saslProc = SaslFactory.create(saslArgs.saslMechanism);
            }
            if (this._saslProc != null) {
                //this._saslProc.SaslProperties = saslArgs.SaslProperties;
                this._saslProc.username = this._xmppClient.username;
                this._saslProc.password = this._xmppClient.password;
                this._saslProc.server = this._xmppClient.xmppDomain;
                this._saslProc.init(this._xmppClient);
            }
        };
        SaslHandler.prototype.selectSaslMechanism = function (mechanisms) {
            for (var i = 0; i < SaslMechanismPriorities.length; i++) {
                var mech = SaslMechanismPriorities[i];
                if (mechanisms.supportsMechanism(mech))
                    return SaslFactory.create(mech);
            }
            return null; // TODO throw ex
        };
        SaslHandler.prototype.endSasl = function () {
            // Remove event handlers
            this._xmppClient.xmppStreamParser.onStreamElement.off(this.streamElementHandler);
            // destroy SaslProcessor
            this._saslProc = null;
        };
        return SaslHandler;
    })();
    Matrix.SaslHandler = SaslHandler;
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="xml/XmppXElement.ts" />
/// <reference path="EventArgs.ts" />
var Matrix;
(function (Matrix) {
    "use strict";
    var StanzaEventArgs = (function (_super) {
        __extends(StanzaEventArgs, _super);
        function StanzaEventArgs(stanza) {
            _super.call(this);
            if (stanza)
                this._stanza = stanza;
        }
        Object.defineProperty(StanzaEventArgs.prototype, "stanza", {
            get: function () { return this._stanza; },
            enumerable: true,
            configurable: true
        });
        return StanzaEventArgs;
    })(Matrix.EventArgs);
    Matrix.StanzaEventArgs = StanzaEventArgs;
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
var Matrix;
(function (Matrix) {
    "use strict";
    var StreamFeatureHelper = (function () {
        function StreamFeatureHelper() {
        }
        Object.defineProperty(StreamFeatureHelper.prototype, "sasl", {
            get: function () { return this._sasl; },
            set: function (value) { this._sasl = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(StreamFeatureHelper.prototype, "resourceBinding", {
            get: function () { return this._resourceBinding; },
            set: function (value) { this._resourceBinding = value; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(StreamFeatureHelper.prototype, "sessionRequired", {
            get: function () { return this._sessionRequired; },
            set: function (value) { this._sessionRequired = value; },
            enumerable: true,
            configurable: true
        });
        //public get tls(): boolean { return this._tls; }
        //public set tls(value: boolean) { this._tls = value; }
        //public get compression(): boolean { return this._compression; }
        //public set compression(value: boolean) { this._compression = value; }
        StreamFeatureHelper.prototype.reset = function () {
            this.sasl = false;
            this._resourceBinding = false;
            //this.tls = false;
            //this.compression = false;
        };
        return StreamFeatureHelper;
    })();
    Matrix.StreamFeatureHelper = StreamFeatureHelper;
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Collections/Collections.ts" />
/// <reference path="XmppXElement.ts" />
var Matrix;
(function (Matrix) {
    var Xml;
    (function (Xml) {
        var Factory;
        (function (Factory) {
            "use strict";
            var Dictionary = Matrix.Collections.Dictionary;
            //var _dict = new Dictionary<string, string>();
            var _dict = new Dictionary();
            var isFactoryInitialized = false;
            //XmppXElement>(typee: { new (): T; }) 
            function buildKey(ns, localName) {
                return "{" + ns + "}" + localName;
            }
            function create(c) {
                return new c();
            }
            Factory.create = create;
            /*
            export function create(className: string) {
                var arr = className.split(".");
                
                // windows is global in node.js
                var fn: any = window;
                for (var i = 0, len = arr.length; i < len; i++) {
                    fn = fn[arr[i]];
                }
                //var newInstance = Object.create(window["Matrix"]["Xmpp"]["Client"]["Message"].prototype);
                var newInstance = Object.create(fn.prototype);
                newInstance.constructor.apply(newInstance);
                return newInstance;
            }
              
            export function registerElement(ns: string, tagname: string, clazz: string) {
                var key = buildKey(ns, tagname);
                //var clazzType = typeof clazz;
                
                _dict.setValue(key, clazz);
            }
            */
            function registerElement(ns, tagname, el) {
                var key = buildKey(ns, tagname);
                _dict.setValue(key, el);
            }
            Factory.registerElement = registerElement;
            function initFactory() {
                // stream client
                registerElement(Matrix.Namespaces.stream, "strea,", Matrix.Xmpp.Client.Stream);
                // stream features
                registerElement(Matrix.Namespaces.stream, "features", Matrix.Xmpp.Stream.StreamFeatures);
                registerElement(Matrix.Namespaces.featureIqRegister, "register", Matrix.Xmpp.Stream.Features.Register);
                registerElement(Matrix.Namespaces.sasl, "mechanism", Matrix.Xmpp.Sasl.Mechanism);
                registerElement(Matrix.Namespaces.sasl, "mechanisms", Matrix.Xmpp.Sasl.Mechanisms);
                registerElement(Matrix.Namespaces.sasl, "auth", Matrix.Xmpp.Sasl.Auth);
                registerElement(Matrix.Namespaces.sasl, "challenge", Matrix.Xmpp.Sasl.Challenge);
                registerElement(Matrix.Namespaces.sasl, "response", Matrix.Xmpp.Sasl.Response);
                registerElement(Matrix.Namespaces.sasl, "success", Matrix.Xmpp.Sasl.Success);
                registerElement(Matrix.Namespaces.sasl, "failure", Matrix.Xmpp.Sasl.Failure);
                registerElement(Matrix.Namespaces.bind, "bind", Matrix.Xmpp.Bind.Bind);
                registerElement(Matrix.Namespaces.session, "session", Matrix.Xmpp.Session.Session);
                registerElement(Matrix.Namespaces.client, "iq", Matrix.Xmpp.Client.Iq);
                registerElement(Matrix.Namespaces.client, "presene", Matrix.Xmpp.Client.Presence);
                registerElement(Matrix.Namespaces.client, "message", Matrix.Xmpp.Client.Message);
                registerElement(Matrix.Namespaces.iqRoster, "item", Matrix.Xmpp.Roster.RosterItem);
                registerElement(Matrix.Namespaces.iqRoster, "query", Matrix.Xmpp.Roster.Roster);
                registerElement(Matrix.Namespaces.httpBind, "body", Matrix.Xmpp.Bosh.Body);
                // websocket framing
                registerElement(Matrix.Namespaces.framing, "open", Matrix.Xmpp.Framing.Open);
                registerElement(Matrix.Namespaces.framing, "close", Matrix.Xmpp.Framing.Close);
                registerElement(Matrix.Namespaces.delay, "delay", Matrix.Xmpp.Delay.Delay);
                // MUC
                registerElement(Matrix.Namespaces.muc, "history", Matrix.Xmpp.Muc.History);
                registerElement(Matrix.Namespaces.muc, "x", Matrix.Xmpp.Muc.X);
                //registerElement(Namespaces.muc, "item", Matrix.Xmpp.Muc.Item);
                registerElement(Matrix.Namespaces.xConference, "x", Matrix.Xmpp.Muc.Conference);
                registerElement(Matrix.Namespaces.mucUser, "status", Matrix.Xmpp.Muc.User.Status);
                registerElement(Matrix.Namespaces.mucUser, "continue", Matrix.Xmpp.Muc.User.Continue);
                registerElement(Matrix.Namespaces.mucUser, "actor", Matrix.Xmpp.Muc.User.Actor);
                isFactoryInitialized = true;
            }
            /*
            export function getElement(prefix: string, localName: string, ns: string): XmppXElement {
                if (!isFactoryInitialized)
                    initFactory();
        
                var key = buildKey(ns, localName);
                if (_dict.containsKey(key)) {
                    var clazz = _dict.getValue(key);
                    return create(clazz);
                }
        
                return new XmppXElement(ns, localName);
            }
            */
            function getElement(prefix, localName, ns) {
                if (!isFactoryInitialized)
                    initFactory();
                var key = buildKey(ns, localName);
                if (_dict.containsKey(key)) {
                    var clazz = _dict.getValue(key);
                    return create(clazz);
                }
                return new Xml.XmppXElement(ns, localName);
            }
            Factory.getElement = getElement;
        })(Factory = Xml.Factory || (Xml.Factory = {}));
    })(Xml = Matrix.Xml || (Matrix.Xml = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Events.ts" />
/// <reference path="../EventArgs.ts" />
/// <reference path="../Typings/ltxml.d.ts" />
/// <reference path="../Typings/sax.d.ts" />
/// <reference path="../StanzaEventArgs.ts" />
/// <reference path="../ExceptionEventArgs.ts" />
var Matrix;
(function (Matrix) {
    var Xml;
    (function (Xml) {
        "use strict";
        var GenericEvent = Matrix.GenericEvent;
        var XmppStreamParser = (function () {
            function XmppStreamParser() {
                //// stream header received
                this.onStreamStart = new GenericEvent();
                //// xmpp stanza/element received
                this.onStreamElement = new GenericEvent();
                //// stream footer received
                this.onStreamEnd = new GenericEvent();
                //// sEvent for XML  errors
                this.onStreamError = new GenericEvent();
                //  Event for general errors
                this.onError = new GenericEvent();
                this._depth = 0;
                this.saxOpts = {
                    lowercase: true,
                    normalize: true,
                    xmlns: true,
                    position: true
                };
                this.initParser();
            }
            XmppStreamParser.prototype.reset = function () {
                this.initParser();
            };
            XmppStreamParser.prototype.initParser = function () {
                var _this = this;
                this._depth = 0;
                this._root = null;
                this._current = null;
                this._parser = null;
                this._parser = new sax.SAXParser(/*strict=*/ true, this.saxOpts);
                this._parser.onerror = function (e) {
                    _this.onStreamError.trigger(new Matrix.ExceptionEventArgs(e.message));
                    //console.log("onerror: " + e);
                };
                this._parser.ontext = function (text) {
                    //console.log("ontext: " + text);
                    _this._current.add(new Ltxml.XText(text));
                };
                this._parser.onopentag = function (tag) {
                    _this._depth++;
                    //this._nsStack.push();
                    var newel = Xml.Factory.getElement(tag.prefix, tag.local, tag.uri);
                    for (var key in tag.attributes) {
                        var attr = tag.attributes[key];
                        //newel.setAttribute(attr.name, attr.value);
                        var ns;
                        var xn;
                        if (attr.uri === "" && attr.prefix !== "xmlns") {
                            if (attr.prefix === "xml") {
                                ns = Ltxml.XNamespace.getXml();
                            }
                            else {
                                ns = Ltxml.XNamespace.getNone();
                            }
                        }
                        else {
                            if (attr.uri === "http://www.w3.org/2000/xmlns/" ||
                                attr.prefix === "xmlns") {
                                ns = Ltxml.XNamespace.getXmlns();
                            }
                            else if (attr.uri === "http://www.w3.org/XML/1998/namespace") {
                                ns = Ltxml.XNamespace.getXml();
                            }
                            else {
                                ns = new Ltxml.XNamespace(attr.uri, attr.prefix ? attr.prefix.toString() : null);
                            }
                        }
                        if (attr.local) {
                            xn = new Ltxml.XName(ns, attr.local);
                        }
                        else {
                            if (attr.name === "xmlns") {
                                xn = new Ltxml.XName(ns, "xmlns");
                            }
                            else {
                                xn = new Ltxml.XName(ns, attr.name /* node.baseName*/);
                            }
                        }
                        newel.add(new Ltxml.XAttribute(xn, attr.value));
                    }
                    if (_this._root == null) {
                        _this._root = newel;
                        _this.onStreamStart.trigger(new Matrix.StanzaEventArgs(_this._root));
                    }
                    else {
                        if (_this._current != null)
                            _this._current.add(newel);
                        _this._current = newel;
                    }
                };
                this._parser.onclosetag = function (tagname) {
                    _this._depth--;
                    if (_this._current == null) {
                        _this.onStreamEnd.trigger();
                        return;
                    }
                    var parent = _this._current.parent;
                    if (parent == null) {
                        _this.onStreamElement.trigger(new Matrix.StanzaEventArgs(_this._current));
                    }
                    _this._current = parent;
                };
                //this._parser.onattribute = (attr: { name: string; value: string; }) => {
                //    console.log("onattribute: " + attr.name + " \ " + attr.value);
                //};
                this._parser.onend = function () {
                    //console.log("onend");
                };
            };
            //public get depth(): number { return this._depth; }
            XmppStreamParser.prototype.write = function (data) {
                this._parser.write(data);
            };
            return XmppStreamParser;
        })();
        Xml.XmppStreamParser = XmppStreamParser;
    })(Xml = Matrix.Xml || (Matrix.Xml = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="XmppXElementWithAddressAndIdAndVersion.ts" />
/// <reference path="../../Namespaces.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Base;
        (function (Base) {
            "use strict";
            var Stream = (function (_super) {
                __extends(Stream, _super);
                function Stream() {
                    _super.call(this, Matrix.Namespaces.stream, "stream", "stream");
                }
                return Stream;
            })(Base.XmppXElementWithAddressAndIdAndVersion);
            Base.Stream = Stream;
        })(Base = Xmpp.Base || (Xmpp.Base = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../xml/XmppXElement.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Base;
        (function (Base) {
            "use strict";
            var XmppXElement = Matrix.Xml.XmppXElement;
            var XmppXElementWithIdAttribute = (function (_super) {
                __extends(XmppXElementWithIdAttribute, _super);
                function XmppXElementWithIdAttribute(ns, tagname) {
                    _super.call(this, ns, tagname);
                }
                Object.defineProperty(XmppXElementWithIdAttribute.prototype, "id", {
                    get: function () {
                        return this.getAttribute("id");
                    },
                    set: function (value) {
                        this.setAttribute("id", value);
                    },
                    enumerable: true,
                    configurable: true
                });
                return XmppXElementWithIdAttribute;
            })(XmppXElement);
            Base.XmppXElementWithIdAttribute = XmppXElementWithIdAttribute;
        })(Base = Xmpp.Base || (Xmpp.Base = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../xml/XmppXElement.ts" />
/// <reference path="../../Sasl/SaslMechanism.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Sasl;
        (function (Sasl) {
            "use strict";
            var XmppXElement = Matrix.Xml.XmppXElement;
            var Mechanisms = (function (_super) {
                __extends(Mechanisms, _super);
                function Mechanisms() {
                    _super.call(this, Matrix.Namespaces.sasl, "mechanisms");
                }
                Mechanisms.prototype.getMechanisms = function () {
                    return this.elementsOfType(Sasl.Mechanism);
                };
                Mechanisms.prototype.supportsMechanism = function (mech) {
                    return this.getMechanisms().any(function (n) { return (n.saslMechanism === mech); });
                };
                Mechanisms.prototype.getMechanism = function (mech) {
                    return this.getMechanisms()
                        .firstOrDefault(function (n) { return n.saslMechanism === mech; });
                };
                return Mechanisms;
            })(XmppXElement);
            Sasl.Mechanisms = Mechanisms;
        })(Sasl = Xmpp.Sasl || (Xmpp.Sasl = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../../Xml/XmppXElement.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Stream;
        (function (Stream) {
            var Features;
            (function (Features) {
                "use strict";
                var XmppXElement = Matrix.Xml.XmppXElement;
                var Register = (function (_super) {
                    __extends(Register, _super);
                    function Register() {
                        _super.call(this, Matrix.Namespaces.featureIqRegister, "register");
                    }
                    return Register;
                })(XmppXElement);
                Features.Register = Register;
            })(Features = Stream.Features || (Stream.Features = {}));
        })(Stream = Xmpp.Stream || (Xmpp.Stream = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../../Xml/XmppXElement.ts" />
/// <reference path="../Sasl/Mechanisms.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Stream;
        (function (Stream) {
            "use strict";
            var XmppXElement = Matrix.Xml.XmppXElement;
            var Mechanisms = Matrix.Xmpp.Sasl.Mechanisms;
            var StreamFeatures = (function (_super) {
                __extends(StreamFeatures, _super);
                function StreamFeatures() {
                    _super.call(this, Matrix.Namespaces.stream, "features", "stream");
                }
                Object.defineProperty(StreamFeatures.prototype, "mechanisms", {
                    /// <summary>
                    /// Sasl mechanisms stream feature
                    /// </summary>
                    get: function () { return this.elementOfType(Mechanisms); },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(StreamFeatures.prototype, "supportsBind", {
                    /// <summary>
                    /// Is resource binding supported?
                    /// </summary>
                    get: function () { return this.hasElementOfType(Matrix.Xmpp.Bind.Bind); },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(StreamFeatures.prototype, "supportsSession", {
                    get: function () { return this.hasElementOfType(Matrix.Xmpp.Bind.Bind); },
                    enumerable: true,
                    configurable: true
                });
                return StreamFeatures;
            })(XmppXElement);
            Stream.StreamFeatures = StreamFeatures;
        })(Stream = Xmpp.Stream || (Xmpp.Stream = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
// based on:
/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.1 Copyright (C) Paul Johnston 1999 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */
var Matrix;
(function (Matrix) {
    var Crypt;
    (function (Crypt) {
        var MD5;
        (function (MD5) {
            "use strict";
            /*
            * Configurable variables. You may need to tweak these to be compatible with
            * the server-side, but the defaults work in most cases.
            */
            var hexcase = 0; /* hex output format. 0 - lowercase; 1 - uppercase */
            var b64pad = ""; /* base-64 pad character. "=" for strict RFC compliance */
            var chrsz = 8; /* bits per input character. 8 - ASCII; 16 - Unicode */
            /*
                 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
                 * to work around bugs in some JS interpreters.
                 */
            function safe_add(x, y) {
                var lsw = (x & 0xFFFF) + (y & 0xFFFF);
                var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
                return (msw << 16) | (lsw & 0xFFFF);
            }
            /*
            * Bitwise rotate a 32-bit number to the left.
            */
            function bit_rol(num, cnt) {
                return (num << cnt) | (num >>> (32 - cnt));
            }
            /*
            * Convert a string to an array of little-endian words
            * If chrsz is ASCII, characters >255 have their hi-byte silently ignored.
            */
            function str2binl(str) {
                var bin = [];
                var mask = (1 << chrsz) - 1;
                for (var i = 0; i < str.length * chrsz; i += chrsz) {
                    bin[i >> 5] |= (str.charCodeAt(i / chrsz) & mask) << (i % 32);
                }
                return bin;
            }
            /*
             * Convert an array of little-endian words to a string
             */
            function binl2str(bin) {
                var str = "";
                var mask = (1 << chrsz) - 1;
                for (var i = 0; i < bin.length * 32; i += chrsz) {
                    str += String.fromCharCode((bin[i >> 5] >>> (i % 32)) & mask);
                }
                return str;
            }
            /*
            * Convert an array of little-endian words to a hex string.
            */
            function binl2hex(binarray) {
                var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
                var str = "";
                for (var i = 0; i < binarray.length * 4; i++) {
                    str += hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF) +
                        hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xF);
                }
                return str;
            }
            /*
             * Convert an array of little-endian words to a base-64 string
             */
            function binl2b64(binarray) {
                var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                var str = "";
                var triplet, j;
                for (var i = 0; i < binarray.length * 4; i += 3) {
                    triplet = (((binarray[i >> 2] >> 8 * (i % 4)) & 0xFF) << 16) |
                        (((binarray[i + 1 >> 2] >> 8 * ((i + 1) % 4)) & 0xFF) << 8) |
                        ((binarray[i + 2 >> 2] >> 8 * ((i + 2) % 4)) & 0xFF);
                    for (j = 0; j < 4; j++) {
                        if (i * 8 + j * 6 > binarray.length * 32) {
                            str += b64pad;
                        }
                        else {
                            str += tab.charAt((triplet >> 6 * (3 - j)) & 0x3F);
                        }
                    }
                }
                return str;
            }
            /*
            * These functions implement the four basic operations the algorithm uses.
            */
            function md5_cmn(q, a, b, x, s, t) {
                return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
            }
            function md5_ff(a, b, c, d, x, s, t) {
                return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
            }
            function md5_gg(a, b, c, d, x, s, t) {
                return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
            }
            function md5_hh(a, b, c, d, x, s, t) {
                return md5_cmn(b ^ c ^ d, a, b, x, s, t);
            }
            function md5_ii(a, b, c, d, x, s, t) {
                return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
            }
            /*
            * Calculate the MD5 of an array of little-endian words, and a bit length
            */
            function core_md5(x, len) {
                /* append padding */
                x[len >> 5] |= 0x80 << ((len) % 32);
                x[(((len + 64) >>> 9) << 4) + 14] = len;
                var a = 1732584193;
                var b = -271733879;
                var c = -1732584194;
                var d = 271733878;
                var olda, oldb, oldc, oldd;
                for (var i = 0; i < x.length; i += 16) {
                    olda = a;
                    oldb = b;
                    oldc = c;
                    oldd = d;
                    a = md5_ff(a, b, c, d, x[i + 0], 7, -680876936);
                    d = md5_ff(d, a, b, c, x[i + 1], 12, -389564586);
                    c = md5_ff(c, d, a, b, x[i + 2], 17, 606105819);
                    b = md5_ff(b, c, d, a, x[i + 3], 22, -1044525330);
                    a = md5_ff(a, b, c, d, x[i + 4], 7, -176418897);
                    d = md5_ff(d, a, b, c, x[i + 5], 12, 1200080426);
                    c = md5_ff(c, d, a, b, x[i + 6], 17, -1473231341);
                    b = md5_ff(b, c, d, a, x[i + 7], 22, -45705983);
                    a = md5_ff(a, b, c, d, x[i + 8], 7, 1770035416);
                    d = md5_ff(d, a, b, c, x[i + 9], 12, -1958414417);
                    c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
                    b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
                    a = md5_ff(a, b, c, d, x[i + 12], 7, 1804603682);
                    d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
                    c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
                    b = md5_ff(b, c, d, a, x[i + 15], 22, 1236535329);
                    a = md5_gg(a, b, c, d, x[i + 1], 5, -165796510);
                    d = md5_gg(d, a, b, c, x[i + 6], 9, -1069501632);
                    c = md5_gg(c, d, a, b, x[i + 11], 14, 643717713);
                    b = md5_gg(b, c, d, a, x[i + 0], 20, -373897302);
                    a = md5_gg(a, b, c, d, x[i + 5], 5, -701558691);
                    d = md5_gg(d, a, b, c, x[i + 10], 9, 38016083);
                    c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
                    b = md5_gg(b, c, d, a, x[i + 4], 20, -405537848);
                    a = md5_gg(a, b, c, d, x[i + 9], 5, 568446438);
                    d = md5_gg(d, a, b, c, x[i + 14], 9, -1019803690);
                    c = md5_gg(c, d, a, b, x[i + 3], 14, -187363961);
                    b = md5_gg(b, c, d, a, x[i + 8], 20, 1163531501);
                    a = md5_gg(a, b, c, d, x[i + 13], 5, -1444681467);
                    d = md5_gg(d, a, b, c, x[i + 2], 9, -51403784);
                    c = md5_gg(c, d, a, b, x[i + 7], 14, 1735328473);
                    b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);
                    a = md5_hh(a, b, c, d, x[i + 5], 4, -378558);
                    d = md5_hh(d, a, b, c, x[i + 8], 11, -2022574463);
                    c = md5_hh(c, d, a, b, x[i + 11], 16, 1839030562);
                    b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
                    a = md5_hh(a, b, c, d, x[i + 1], 4, -1530992060);
                    d = md5_hh(d, a, b, c, x[i + 4], 11, 1272893353);
                    c = md5_hh(c, d, a, b, x[i + 7], 16, -155497632);
                    b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
                    a = md5_hh(a, b, c, d, x[i + 13], 4, 681279174);
                    d = md5_hh(d, a, b, c, x[i + 0], 11, -358537222);
                    c = md5_hh(c, d, a, b, x[i + 3], 16, -722521979);
                    b = md5_hh(b, c, d, a, x[i + 6], 23, 76029189);
                    a = md5_hh(a, b, c, d, x[i + 9], 4, -640364487);
                    d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
                    c = md5_hh(c, d, a, b, x[i + 15], 16, 530742520);
                    b = md5_hh(b, c, d, a, x[i + 2], 23, -995338651);
                    a = md5_ii(a, b, c, d, x[i + 0], 6, -198630844);
                    d = md5_ii(d, a, b, c, x[i + 7], 10, 1126891415);
                    c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
                    b = md5_ii(b, c, d, a, x[i + 5], 21, -57434055);
                    a = md5_ii(a, b, c, d, x[i + 12], 6, 1700485571);
                    d = md5_ii(d, a, b, c, x[i + 3], 10, -1894986606);
                    c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
                    b = md5_ii(b, c, d, a, x[i + 1], 21, -2054922799);
                    a = md5_ii(a, b, c, d, x[i + 8], 6, 1873313359);
                    d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
                    c = md5_ii(c, d, a, b, x[i + 6], 15, -1560198380);
                    b = md5_ii(b, c, d, a, x[i + 13], 21, 1309151649);
                    a = md5_ii(a, b, c, d, x[i + 4], 6, -145523070);
                    d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
                    c = md5_ii(c, d, a, b, x[i + 2], 15, 718787259);
                    b = md5_ii(b, c, d, a, x[i + 9], 21, -343485551);
                    a = safe_add(a, olda);
                    b = safe_add(b, oldb);
                    c = safe_add(c, oldc);
                    d = safe_add(d, oldd);
                }
                return [a, b, c, d];
            }
            /*
            * Calculate the HMAC-MD5, of a key and some data
            */
            function core_hmac_md5(key, data) {
                var bkey = str2binl(key);
                if (bkey.length > 16) {
                    bkey = core_md5(bkey, key.length * chrsz);
                }
                var ipad = new Array(16), opad = new Array(16);
                for (var i = 0; i < 16; i++) {
                    ipad[i] = bkey[i] ^ 0x36363636;
                    opad[i] = bkey[i] ^ 0x5C5C5C5C;
                }
                var hash = core_md5(ipad.concat(str2binl(data)), 512 + data.length * chrsz);
                return core_md5(opad.concat(hash), 512 + 128);
            }
            /*
            * These are the functions you'll usually want to call.
            * They take string arguments and return either hex or base-64 encoded
            * strings.
            */
            function hexdigest(s) {
                return binl2hex(core_md5(str2binl(s), s.length * chrsz));
            }
            MD5.hexdigest = hexdigest;
            function b64digest(s) {
                return binl2b64(core_md5(str2binl(s), s.length * chrsz));
            }
            MD5.b64digest = b64digest;
            function hash(s) {
                return binl2str(core_md5(str2binl(s), s.length * chrsz));
            }
            MD5.hash = hash;
            function hmac_hexdigest(key, data) {
                return binl2hex(core_hmac_md5(key, data));
            }
            MD5.hmac_hexdigest = hmac_hexdigest;
            function hmac_b64digest(key, data) {
                return binl2b64(core_hmac_md5(key, data));
            }
            MD5.hmac_b64digest = hmac_b64digest;
            function hmac_hash(key, data) {
                return binl2str(core_hmac_md5(key, data));
            }
            MD5.hmac_hash = hmac_hash;
        })(MD5 = Crypt.MD5 || (Crypt.MD5 = {}));
    })(Crypt = Matrix.Crypt || (Matrix.Crypt = {}));
})(Matrix || (Matrix = {}));
/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net *
 */
/// <reference path="../Base/Stream.ts" />
/// <reference path="../../Namespaces.ts" />
var Matrix;
(function (Matrix) {
    var Xmpp;
    (function (Xmpp) {
        var Client;
        (function (Client) {
            "use strict";
            var Stream = (function (_super) {
                __extends(Stream, _super);
                function Stream() {
                    _super.call(this);
                    this.setAttribute("xmlns", Matrix.Namespaces.client);
                }
                return Stream;
            })(Xmpp.Base.Stream);
            Client.Stream = Stream;
        })(Client = Xmpp.Client || (Xmpp.Client = {}));
    })(Xmpp = Matrix.Xmpp || (Matrix.Xmpp = {}));
})(Matrix || (Matrix = {}));
//# sourceMappingURL=matrix.js.map