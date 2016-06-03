/// <reference path="scripts/typings/jquery/jquery.d.ts" />
/// <reference path="matrix.d.ts" />
/// <reference path="scripts/typings/lib.d.ts" />
/// <reference path="typings/ltxml.d.ts" />
var client;
function htmlEncode(value) {
    //create a in-memory div, set it's inner text(which jQuery automatically encodes)
    //then grab the encoded contents back out. The div never exists on the page.
    return $('<div/>').text(value).html();
}
function getTimeStamp() {
    var now = new Date();
    return now.toLocaleTimeString();
}
request: Matrix.Net.WebRequest;
$(document).ready(function () {
    client = new Matrix.XmppClient();
    client.onReadXml.on(function (args) {
        $('#xmlLog').append('<div class="log"><span class="ts">' + getTimeStamp() + '</span><span class="recv">RECV:</span><span class="xml">' + htmlEncode(args.text) + '</span></div>');
    });
    client.onWriteXml.on(function (args) {
        $('#xmlLog').append('<div class="log"><span class="ts">' + getTimeStamp() + '</span><span class="send">SEND:</span><span class="xml">' + htmlEncode(args.text) + '</span></div>');
    });
    client.onLogin.on(function (args) {
        logEvent("onLogin");
    });
    client.onClose.on(function (args) {
        logEvent("onClose");
    });
    client.onBindStart.on(function (args) {
        logEvent("onBindStart");
    });
    client.onBind.on(function (args) {
        logEvent("onBind");
    });
    client.onRosterStart.on(function (args) {
        logEvent("onRosterStart");
    });
    client.onRosterEnd.on(function (args) {
        logEvent("onRosterEnd");
    });
    client.onRosterItem.on(function (args) {
        logEvent("onRosterItem", args.rosterItem.jid.toString());
        $('#roster').append("<div>" + args.rosterItem.jid + "</div>");
    });
    client.onError.on(function (args) {
        logEvent("onError: " + args.exception);
    });
    client.onSaslStart.on(function (args) {
        logEvent("onSaslStart");
        // manually select SASL mechansm
        //args.auto = false;
        //args.saslMechanism = Matrix.Sasl.SaslMechanism.Plain;
    });
});
function logEvent(name, text) {
    if (text === void 0) { text = null; }
    var html = '<div class="event"><span class="event">' + name + '</span>';
    if (text != null)
        html += '<span class="xml" >' + text + '</span>';
    html += '</div>';
    $('#events').append(html);
}
$("#connect").click(function () {
    if ($('input[name=optionsTransport]:checked').val() == "bosh") {
        client.transport = 1 /* Bosh */;
        client.uri = $('#uri').val();
    }
    else {
        client.transport = 0 /* Websocket */;
        client.uri = $('#uriWS').val();
    }
    client.username = $('#username').val();
    client.password = $('#password').val();
    client.xmppDomain = $('#xmppDomain').val();
    client.open();
});
$("#disconnect").click(function () {
    client.close();
});
//# sourceMappingURL=XmppClientDemo.js.map