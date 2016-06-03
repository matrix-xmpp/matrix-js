/// <reference path="../../Library/matrix.d.ts" />
QUnit.test("Util HexToString", function (assert) {
    var buf: Array<number> = [1, 100, 20, 211, 255];
    var hex = Matrix.Util.Functions.hexToString(buf);
    assert.equal(hex, "016414d3ff");
});  


QUnit.test("Enum getEnumString", function (assert) {
    var eString = Matrix.Util.Enum.toString(Matrix.Xmpp.MessageType, Matrix.Xmpp.MessageType.Headline);
    assert.equal(eString, "Headline");
});  

QUnit.test("Enum parse", function (assert) {

    var msgType = <Matrix.Xmpp.MessageType> Matrix.Util.Enum.parse(Matrix.Xmpp.MessageType, "headline");
    assert.equal(msgType, Matrix.Xmpp.MessageType.Headline);
    assert.notEqual(msgType, Matrix.Xmpp.MessageType.GroupChat);

    var msgType2 = <Matrix.Xmpp.MessageType> Matrix.Util.Enum.parse(Matrix.Xmpp.MessageType, "foo");
    assert.equal(msgType2, Matrix.Xmpp.MessageType.Normal);
});  

