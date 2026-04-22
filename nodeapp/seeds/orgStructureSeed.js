// seeds a minimal org structure for TUKE on first startup;
// uses findOrCreate so re-running on an already-populated DB is safe
async function seedOrgStructure(db) {
    async function findOrCreateUnit(name, type, parentId, studentPickable = false) {
        const where = parentId != null
            ? { name, parentId }
            : { name, parentId: null };

        let unit = await db.OrgUnits.findOne({ where });
        if (!unit) {
            unit = await db.OrgUnits.create({ name, type: type || null, parentId: parentId || null, studentPickable });
        }
        return unit;
    }

    async function findOrCreateRole(name, orgUnitId, { emailPattern = null, accessCode = null, isStudentRole = false, sortOrder = null } = {}) {
        let role = await db.OrgRoles.findOne({ where: { name, orgUnitId } });
        if (!role) {
            role = await db.OrgRoles.create({ name, orgUnitId, emailPattern, accessCode, isStudentRole, sortOrder });
        }
        return role;
    }

    const university = await findOrCreateUnit('Technická univerzita v Košiciach', 'university', null);

    const fei = await findOrCreateUnit('FEI', 'faculty', university.id);

    await findOrCreateRole('Dean', fei.id, { accessCode: '12345' });

    const bcStudies = await findOrCreateUnit('BC Studies', null, fei.id);
    const informatics = await findOrCreateUnit('Informatics', null, bcStudies.id);

    const year1 = await findOrCreateUnit('1. year', null, informatics.id, true);
    const year2 = await findOrCreateUnit('2. year', null, informatics.id, true);
    const year3 = await findOrCreateUnit('3. year', null, informatics.id, true);

    const yearUnits = [
        { unit: year1, sortOrder: 1 },
        { unit: year2, sortOrder: 2 },
        { unit: year3, sortOrder: 3 },
    ];

    for (const { unit, sortOrder } of yearUnits) {
        await findOrCreateRole('Student', unit.id, {
            emailPattern: '@student.tuke.sk',
            isStudentRole: true,
            sortOrder,
        });
        await findOrCreateRole('Professor', unit.id, { accessCode: '12345' });
    }
}

module.exports = { seedOrgStructure };
