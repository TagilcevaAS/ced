const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const ADMIN_EMAIL = 'admin@gmail.com';

const checkAdmin = async (uid) => {
    const userRecord = await admin.auth().getUser(uid);
    if (userRecord.email !== ADMIN_EMAIL) {
        throw new functions.https.HttpsError('permission-denied', 'User is not authorized to perform this action');
    }
};

exports.editReport = functions.https.onCall(async (data, context) => {
    const { reportId, newContent } = data;
    const uid = context.auth.uid;

    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    await checkAdmin(uid);

    const reportRef = admin.firestore().collection('unsubmitted_reports').doc(reportId);
    const reportDoc = await reportRef.get();

    if (!reportDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Report not found');
    }

    await reportRef.update({ content: newContent });
    return { success: true };
});

exports.deleteReport = functions.https.onCall(async (data, context) => {
    const { reportId } = data;
    const uid = context.auth.uid;

    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    await checkAdmin(uid);

    const reportRef = admin.firestore().collection('unsubmitted_reports').doc(reportId);
    const reportDoc = await reportRef.get();

    if (!reportDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Report not found');
    }

    await reportRef.delete();
    return { success: true };
});
