/// <reference path="../../Library/matrix.d.ts" />
QUnit.test("MD5 hexdigest", function (assert) {
    var hash = Matrix.Crypt.MD5.hexdigest("abc");
    assert.equal(hash, "900150983cd24fb0d6963f7d28e17f72");
});  