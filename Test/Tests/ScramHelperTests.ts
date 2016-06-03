/// <reference path="../../Library/matrix.d.ts" />
QUnit.test("ScramHelper hi", function (assert) {
    var salt = "\x00\x01\x02\x03\x04\x05\x06\xF1\xF0\xEE\x21\x22\x45";
    var srcamHelper = new Matrix.Sasl.Scram.ScramHelper();
    var resHi = srcamHelper.hi("secret", salt, 1000);
    var resB64 = Matrix.Util.Base64.encode(resHi);

    assert.equal(resB64, "tdubWkdEhUy2CzQ/tibrlhHVJu8=");
}); 