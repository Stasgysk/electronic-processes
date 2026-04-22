// checks if the session's expiry date has already passed
function isSessionExpired(session) {
    return new Date() > session.expiresAt;
}

// deletes all expired sessions for a given user (called after login to clean up old ones)
async function removeExpiredSessions(userId) {
    const sessions = await postgres.UsersSessions.entities({ userId });

    for(let session of sessions) {
        if(new Date() > session.expiresAt) await session.destroy();
    }
}

// same as above but looks up sessions by session id instead of user id
async function removeExpiredSessionsBySessionId(sessionId) {
    const sessions = await postgres.UsersSessions.entities({ sessionId });

    for(let session of sessions) {
        if(new Date() > session.expiresAt) await session.destroy();
    }
}

// returns the STUDENT group id for emails with @student.tuke.sk, 0 for everyone else
async function getRoleByEmail(email) {
    if (email.includes('@student.tuke.sk')) {
        const userRole = await postgres.UsersGroups.entity({ name: "STUDENT" });
        return userRole ? userRole.id : 0;
    }
    return 0;
}

// assigns org roles to a user based on email pattern matching within their primary org unit.
// called on every login so role assignments stay up to date automatically.
async function autoAssignOrgRolesByEmail(userId, email) {
    const user = await postgres.Users.entity({ id: userId });
    if (!user || !user.orgUnitId) return;

    const roles = await postgres.OrgRoles.entities({ orgUnitId: user.orgUnitId }, false, [], 500, 0);
    for (const role of roles) {
        if (role.emailPattern && email.includes(role.emailPattern)) {
            const existing = await postgres.UserOrgRoles.entity({ userId, orgRoleId: role.id });
            if (!existing) {
                await postgres.UserOrgRoles.create({ userId, orgRoleId: role.id });
            }
        }
    }
}

// called when a user's org unit changes (e.g. student moves to a new year).
// removes pattern-matched roles from the old unit and assigns matching ones in the new unit.
async function reassignOrgRolesByEmailAndUnit(userId, email, newOrgUnitId) {
    const allRoles = await postgres.OrgRoles.entities(null, false, [], 5000, 0);
    const patternRoles = allRoles.filter(r => r.emailPattern && email.includes(r.emailPattern));

    for (const role of patternRoles) {
        if (role.orgUnitId !== newOrgUnitId) {
            // remove the role assignment if it belongs to a different unit
            const existing = await postgres.UserOrgRoles.entity({ userId, orgRoleId: role.id });
            if (existing) await existing.destroy();
        } else {
            // make sure the role assignment exists in the new unit
            const existing = await postgres.UserOrgRoles.entity({ userId, orgRoleId: role.id });
            if (!existing) await postgres.UserOrgRoles.create({ userId, orgRoleId: role.id });
        }
    }

    // also assign any student-specific roles defined for the new unit
    const studentRolesInUnit = allRoles.filter(r =>
        r.isStudentRole &&
        r.orgUnitId === newOrgUnitId &&
        (!r.emailPattern || email.includes(r.emailPattern))
    );
    for (const role of studentRolesInUnit) {
        const existing = await postgres.UserOrgRoles.entity({ userId, orgRoleId: role.id });
        if (!existing) await postgres.UserOrgRoles.create({ userId, orgRoleId: role.id });
    }
}

module.exports = {
    isSessionExpired,
    removeExpiredSessions,
    getRoleByEmail,
    removeExpiredSessionsBySessionId,
    autoAssignOrgRolesByEmail,
    reassignOrgRolesByEmailAndUnit,
};
