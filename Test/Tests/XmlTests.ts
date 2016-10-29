/// <reference path="../../Library/matrix.d.ts" />
QUnit.test("Xml Tests Matrix.Xmpp.Client.Stream", function (assert) {
    var clientStream = new Matrix.Xmpp.Client.Stream();
    var expected = "<stream:stream xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams'/>";
    assert.equal(clientStream.toString(), expected);
});  

QUnit.test("Test XmppXElement.startTag()", function (assert) {
    var clientStream = new Matrix.Xmpp.Client.Stream();
    var expectedStartTag = "<stream:stream xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams'>";
    assert.equal(clientStream.startTag(), expectedStartTag);

    clientStream.value = "foo";
    assert.equal(clientStream.startTag(), expectedStartTag);
});  

QUnit.test("Test XmppXElement.setAttribute()", function (assert) {
    var msg = new Matrix.Xmpp.Client.Message();
    msg.setAttribute("a", "1");
    var expected = "<message a='1' xmlns='jabber:client'/>";
    var expected2 = "<message xmlns='jabber:client'/>";
    var expected3 = "<message type='groupchat' xmlns='jabber:client'/>";
    assert.equal(msg.toString(), expected);

    msg.removeAttribute("a");
    assert.equal(msg.toString(), expected2);

    msg.type = Matrix.Xmpp.MessageType.GroupChat;
    assert.equal(msg.toString(), expected3);

    assert.equal(msg.type, Matrix.Xmpp.MessageType.GroupChat);
});  


QUnit.test("Test XmppXElement.loadXml()", function (assert) {
    var xml1 = "<message type='groupchat' xmlns='jabber:client'/>";

    var el = Matrix.Xml.XmppXElement.loadXml(xml1);
    
    assert.equal(el instanceof Matrix.Xmpp.Client.Message, true);
});  

QUnit.test("Test Mechanisms", function (assert) {
    var xml1 = "<mechanisms xmlns='urn:ietf:params:xml:ns:xmpp-sasl' >";
    xml1 += "<mechanism>DIGEST-MD5</mechanism>";
    xml1 += "<mechanism>PLAIN</mechanism>";
    xml1 += "<mechanismx>PLAIN</mechanismx>";
    xml1 += "<mechanismy>PLAIN</mechanismy>";
    xml1 += "</mechanisms>";

    var el = Matrix.Xml.XmppXElement.loadXml(xml1);
    var col = el.elementsOfType(Matrix.Xmpp.Sasl.Mechanism);

    var mechs = <Matrix.Xmpp.Sasl.Mechanisms> el;
    
    assert.equal(col.count(), 2);
    assert.equal(mechs.supportsMechanism(Matrix.Sasl.SaslMechanism.DigestMd5), true);
    assert.equal(mechs.supportsMechanism(Matrix.Sasl.SaslMechanism.Plain), true);
    assert.equal(mechs.supportsMechanism(Matrix.Sasl.SaslMechanism.ScramSha1), false);
}); 


QUnit.test("Test Bind", function (assert) {
    var xml1 = "<bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'>";
    xml1 += "<resource>someresource</resource>";
    xml1 += "<jid>alex@localhost/foo</jid>";
    xml1 += "</bind>";
    
    var el = Matrix.Xml.XmppXElement.loadXml(xml1);
    var bind = <Matrix.Xmpp.Bind.Bind> el;

    assert.equal(bind.resource, "someresource");
    assert.equal(bind.jid.toString(), "alex@localhost/foo");
    
}); 

QUnit.test("Test Bosh body", function (assert) {
    var xml1 = "<body content='text/xml; charset=utf-8'";
    xml1 += " from='user@example.com'";
    xml1 += " hold='1'";
    xml1 += " rid='1573741820'";
    xml1 += " to='example.com'";
    xml1 += " route='xmpp:example.com:9999'";
    xml1 += " wait='60'";
    xml1 += " xml:lang='en'";
    xml1 += " xmpp:version='1.0'";
    xml1 += " xmlns='http://jabber.org/protocol/httpbind'";
    xml1 += " xmlns:xmpp='urn:xmpp:xbosh' />";
    
    var el = Matrix.Xml.XmppXElement.loadXml(xml1);
    
    assert.equal(el instanceof Matrix.Xmpp.Bosh.Body, true);

    var body = <Matrix.Xmpp.Bosh.Body> el;
    assert.equal(body.xmppVersion, "1.0");
}); 


QUnit.test("Test mixed content", function (assert) {
    var xml1 = "<message xmlns='jabber:client'>";
    xml1 += "<body>Wow, I&apos;m green with envy!</body>";
    xml1 += "<html xmlns='http://jabber.org/protocol/xhtml-im'>";
    xml1 += "<body xmlns='http://www.w3.org/1999/xhtml'>";
    xml1 += "<p style='font-size:large'>";
    xml1 += "<em>Wow</em>, I&apos;m <span style='color:green'>green</span>";
    xml1 += "with <strong>envy </strong>!";
    xml1 += "</p>";
    xml1 += "</body>";
    xml1 += "</html>";
    xml1 += "</message>";

    var el = Matrix.Xml.XmppXElement.loadXml(xml1);
    assert.equal(el instanceof Matrix.Xmpp.Client.Message, true);
});


QUnit.test("Test delay", function (assert) {
    var xml1 = "<message xmlns='jabber:client'>";
    xml1 += "<body>123</body>";
    xml1 += "<delay xmlns='urn:xmpp:delay' from='conference.ag-software.net' stamp='2015-05-20T21:27:37Z'/>";
    xml1 += "</message>";
    
    var el = Matrix.Xml.XmppXElement.loadXml(xml1);
    assert.equal(el instanceof Matrix.Xmpp.Client.Message, true);

    var msg = <Matrix.Xmpp.Client.Message> el;

    var delay = msg.delay;
    assert.equal(delay instanceof Matrix.Xmpp.Delay.Delay, true);


    assert.equal(delay.from.bare, "conference.ag-software.net");
    assert.equal(delay.stamp, Date.UTC(2015, 5-1, 20, 21, 27, 37));

});


QUnit.test("Test Muc status", function (assert) {
    var xml1 = "<status xmlns='http://jabber.org/protocol/muc#user' code='110' />";
    
    var el = Matrix.Xml.XmppXElement.loadXml(xml1);
    assert.equal(el instanceof Matrix.Xmpp.Muc.User.Status, true);
    var status = <Matrix.Xmpp.Muc.User.Status> el;
    assert.equal(status.codeInt, 110);
    assert.equal(status.statusCode, Matrix.Xmpp.Muc.User.StatusCode.SelfPresence);
});


QUnit.test("Test Muc Actor", function (assert) {
    var xml1 = "<actor xmlns='http://jabber.org/protocol/muc#user' jid='foo@jabber.org/Home' nick='Foo' />";

    var el = Matrix.Xml.XmppXElement.loadXml(xml1);
    assert.equal(el instanceof Matrix.Xmpp.Muc.User.Actor, true);
    var actor = <Matrix.Xmpp.Muc.User.Actor> el;
    assert.equal(actor.nick, "Foo");
    assert.equal(actor.jid.bare, "foo@jabber.org");
});

QUnit.test("LinqXml1", function (assert) {
    var xml1 = "<actor xmlns='http://jabber.org/protocol/muc#user' jid='foo@jabber.org/Home' nick='Foo' />";

    var el = Matrix.Xml.XmppXElement.loadXml(xml1);
    assert.equal(el instanceof Matrix.Xmpp.Muc.User.Actor, true);
    var actor = <Matrix.Xmpp.Muc.User.Actor>el;
    assert.equal(actor.nick, "Foo");
    assert.equal(actor.jid.bare, "foo@jabber.org");
});