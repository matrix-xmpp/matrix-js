/// <reference path="../../Library/matrix.d.ts" />
QUnit.test("Digest Step1", function (assert) {
    var response: string = 'username="gnauck",realm="",nonce="3677324771",cnonce="28f47432f9606887d9b727e65db225eb7cb4b78073d8b6f32399400e01438f1e",nc=00000001,qop=auth,digest-uri="xmpp/ag-software.net",charset=utf-8,response=9da2f08b8be30d8dfd80b07fa529fd2a';

    var step1 = new Matrix.Sasl.Digest.Step1(response);
    
    // Assert
    equal(step1.nonce, "3677324771");
    equal(step1.charset, "utf-8");
    equal(step1.qop, "auth");
}); 

QUnit.test("Digest Step2", function (assert) {
    var response: string = 'nonce="3677324771",qop="auth",charset=utf-8,algorithm=md5-sess';

    var response2 : string = "username=\"gnauck\",realm=\"\",nonce=\"3677324771\",cnonce=\"28f47432f9606887d9b727e65db225eb7cb4b78073d8b6f32399400e01438f1e\",nc=00000001,qop=auth,digest-uri=\"xmpp/ag-software.net\",charset=utf-8,response=9da2f08b8be30d8dfd80b07fa529fd2a";

    var step1 = new Matrix.Sasl.Digest.Step1(response);
    var proc = new Matrix.Sasl.DigestMD5Processor();
    proc.username = "gnauck";
    proc.password = "secret";
    proc.server = "ag-software.net";
    
    var s2 = new Matrix.Sasl.Digest.Step2(step1, proc);
    equal(s2.nc, "00000001");
}); 


QUnit.test("Test mechanism names", function (assert) {
    assert.equal(Matrix.Sasl.saslMechanismNameToEnum("PLAIN"),         Matrix.Sasl.SaslMechanism.Plain);
    assert.equal(Matrix.Sasl.saslMechanismNameToEnum("DIGEST-MD5"),    Matrix.Sasl.SaslMechanism.DigestMd5);
    assert.equal(Matrix.Sasl.saslMechanismNameToEnum("SCRAM-SHA-1"), Matrix.Sasl.SaslMechanism.ScramSha1);

    assert.equal(Matrix.Sasl.enumToSaslMechanismName(Matrix.Sasl.SaslMechanism.Plain),      "PLAIN");
    assert.equal(Matrix.Sasl.enumToSaslMechanismName(Matrix.Sasl.SaslMechanism.DigestMd5),  "DIGEST-MD5");
    assert.equal(Matrix.Sasl.enumToSaslMechanismName(Matrix.Sasl.SaslMechanism.ScramSha1),  "SCRAM-SHA-1");

    var mech = new Matrix.Xmpp.Sasl.Mechanism();
    mech.value = "PLAIN";
    assert.equal(Matrix.Sasl.SaslMechanism.Plain, mech.saslMechanism);

    mech.value = "SCRAM-SHA-1";
    assert.equal(Matrix.Sasl.SaslMechanism.ScramSha1, mech.saslMechanism);

    mech.saslMechanism = Matrix.Sasl.SaslMechanism.DigestMd5;
    assert.equal(mech.value, "DIGEST-MD5");
});