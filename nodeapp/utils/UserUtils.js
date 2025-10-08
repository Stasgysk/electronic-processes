const {post} = require("axios");

function isSessionExpired(session) {
    return new Date() > session.expiresAt;
}

async function removeExpiredSessions(userId) {
    const sessions = await postgres.UsersSessions.entities({ userId });

    for(let session of sessions) {
        if(new Date() > session.expiresAt) await session.destroy();
    }
}

async function removeExpiredSessionsBySessionId(sessionId) {
    const sessions = await postgres.UsersSessions.entities({ sessionId });

    for(let session of sessions) {
        if(new Date() > session.expiresAt) await session.destroy();
    }
}

async function getRoleByEmail(email) {
    if(email.includes('@student.tuke.sk')) {
        const userRole = await postgres.UsersGroups.entity({name: "STUDENT"});
        return userRole.id;
    } else {
        return 0;
    }
}

module.exports = {
    isSessionExpired,
    removeExpiredSessions,
    getRoleByEmail,
    removeExpiredSessionsBySessionId,
};