/// <reference path="../../Library/matrix.d.ts" />
QUnit.test("Base64 encode and decode", function (assert) {
    assert.equal(Matrix.Util.Base64.decode("Zm9v"), "foo");
    assert.equal(Matrix.Util.Base64.encode("foo"), "Zm9v");
});  