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
    if (email.includes('@student.tuke.sk')) {
        const userRole = await postgres.UsersGroups.entity({ name: "STUDENT" });
        return userRole ? userRole.id : 0;
    }
    return 0;
}

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

async function reassignOrgRolesByEmailAndUnit(userId, email, newOrgUnitId) {
    const allRoles = await postgres.OrgRoles.entities(null, false, [], 5000, 0);
    const patternRoles = allRoles.filter(r => r.emailPattern && email.includes(r.emailPattern));

    for (const role of patternRoles) {
        if (role.orgUnitId !== newOrgUnitId) {
            const existing = await postgres.UserOrgRoles.entity({ userId, orgRoleId: role.id });
            if (existing) await existing.destroy();
        } else {
            const existing = await postgres.UserOrgRoles.entity({ userId, orgRoleId: role.id });
            if (!existing) await postgres.UserOrgRoles.create({ userId, orgRoleId: role.id });
        }
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
