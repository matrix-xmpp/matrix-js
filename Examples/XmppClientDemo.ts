/// <reference path="scripts/typings/jquery/jquery.d.ts" />
/// <reference path="matrix.d.ts" />
/// <reference path="scripts/typings/lib.d.ts" />
/// <reference path="typings/ltxml.d.ts" />
var client: Matrix.XmppClient;

function htmlEncode(value) {
    //create a in-memory div, set it's inner text(which jQuery automatically encodes)
    //then grab the encoded contents back out. The div never exists on the page.
    return $('<div/>').text(value).html();
}

function getTimeStamp() : string {
    var now = new Date();
    return now.toLocaleTimeString();
}

request: Matrix.Net.WebRequest;
$(document).ready(() => {
    
    client = new Matrix.XmppClient();
    client.onReadXml.on((args: Matrix.TextEventArgs) => {
        $('#xmlLog').append('<div class="log"><span class="ts">' + getTimeStamp() + '</span><span class="recv">RECV:</span><span class="xml">' + htmlEncode(args.text) + '</span></div>');
    });

    client.onWriteXml.on((args: Matrix.TextEventArgs) => {
        $('#xmlLog').append('<div class="log"><span class="ts">' + getTimeStamp() + '</span><span class="send">SEND:</span><span class="xml">' + htmlEncode(args.text) + '</span></div>');
    });
       
    client.onLogin.on((args: Matrix.EventArgs) => {
        logEvent("onLogin");
    });

    client.onClose.on((args: Matrix.EventArgs) => {
        logEvent("onClose");
    });

    client.onBindStart.on((args: Matrix.EventArgs) => {
        logEvent("onBindStart");
    });

    client.onBind.on((args: Matrix.EventArgs) => {
        logEvent("onBind");
    });

    client.onRosterStart.on((args: Matrix.EventArgs) => {
        logEvent("onRosterStart");
    });

    client.onRosterEnd.on((args: Matrix.EventArgs) => {
        logEvent("onRosterEnd");
    });

    client.onRosterItem.on((args: Matrix.Xmpp.Roster.RosterEventArgs) => {
        logEvent("onRosterItem", args.rosterItem.jid.toString());
        $('#roster').append("<div>" + args.rosterItem.jid + "</div>");
    });

    client.onError.on((args: Matrix.ExceptionEventArgs) => {
        logEvent("onError: " + args.exception);
    });

    client.onSaslStart.on((args: Matrix.Xmpp.Sasl.SaslEventArgs) => {
        logEvent("onSaslStart");
        // manually select SASL mechansm
        //args.auto = false;
        //args.saslMechanism = Matrix.Sasl.SaslMechanism.Plain;
    });   

});

function logEvent(name: string, text: string = null) {
    var html = '<div class="event"><span class="event">' + name + '</span>';

    if (text != null)
        html += '<span class="xml" >' + text + '</span>';

    html += '</div>';

    $('#events').append(html);
}


$("#connect").click(() => {
    if ($('input[name=optionsTransport]:checked').val() == "bosh") {
        client.transport = Matrix.Transport.Bosh;
        client.uri = $('#uri').val();
    } else {
        client.transport = Matrix.Transport.Websocket;
        client.uri = $('#uriWS').val();
    }
    
    client.username     = $('#username').val();
    client.password     = $('#password').val();
    client.xmppDomain   = $('#xmppDomain').val();

    client.open();
}); 

$("#disconnect").click(() => {
    client.close();
});