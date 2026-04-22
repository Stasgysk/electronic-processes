// First-time setup modal shown to users who haven't completed their profile.
// It blocks the rest of the UI (full-screen backdrop) until the user finishes.
//
// Two flows depending on the user's group:
//
//   STUDENT
//     Must pick an org unit (their current year/faculty) using CascadingUnitPicker.
//     The selected unit is saved as user.orgUnitId via PUT /users.
//
//   Non-student (EMPLOYEE or new user with no group)
//     Must pick one or more workplaces from the org unit list.
//     Optionally can promote themselves to ADMIN by entering the admin access code.
//     Each workplace is saved as a UserWorkplace record.  The user's group (EMPLOYEE or ADMIN)
//     and primary orgUnitId (first workplace) are also updated via PUT /users.

import './OnboardingModal.css';
import { useState, useEffect } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { getOrgUnitsFlat } from '../api/orgUnits.service';
import { addWorkplace } from '../api/userWorkplaces.service';
import gsAxios from '../api/gsAxios';

// Renders a series of dependent dropdowns that drill down the org hierarchy.
// Each level shows the children of the selection made at the previous level.
// Selection is only accepted (onSelect fires with a non-null id) when the user
// picks a unit that has the studentPickable flag and no further children.
function CascadingUnitPicker({ flatUnits, onSelect }) {
    const { t } = useTranslation();
    // path is an array of selected unit IDs from root to the current depth
    const [path, setPath] = useState([]);

    // returns the list of selectable options for a given depth level
    const getOptions = (depth) => {
        if (depth === 0) {
            // skip the university root node (parentId === null) and show its children
            const root = flatUnits.find(u => u.parentId === null);
            if (root) return flatUnits.filter(u => u.parentId === root.id);
            return flatUnits.filter(u => u.parentId === null);
        }
        const parentId = path[depth - 1];
        if (!parentId) return [];
        return flatUnits.filter(u => u.parentId === parentId);
    };

    const handleSelect = (depth, value) => {
        const unitId = value ? parseInt(value) : null;
        // trim the path to this depth and append the new selection
        const newPath = path.slice(0, depth);
        if (unitId) newPath.push(unitId);
        setPath(newPath);

        const finalUnit = unitId ? flatUnits.find(u => u.id === unitId) : null;
        const children = unitId ? flatUnits.filter(u => u.parentId === unitId) : [];
        // only confirm selection when the unit is marked as student-pickable and has no children
        onSelect(finalUnit?.studentPickable && children.length === 0 ? unitId : null);
    };

    // build dropdown levels dynamically; stop when there are no more options or no selection made
    const steps = [];
    for (let d = 0; ; d++) {
        const opts = getOptions(d);
        if (opts.length === 0) break;
        steps.push({ depth: d, options: opts });
        if (!path[d]) break;
    }

    const finalId = path[path.length - 1];
    const finalUnit = finalId ? flatUnits.find(u => u.id === finalId) : null;
    const hasChildren = finalUnit ? flatUnits.some(u => u.parentId === finalUnit.id) : false;
    // valid only when the leaf is explicitly marked as student-pickable
    const isPickable = finalUnit?.studentPickable && !hasChildren;

    return (
        <div className="cascading-picker">
            {steps.map(({ depth, options }) => (
                <Form.Group key={depth} className="mb-2">
                    <Form.Select
                        value={path[depth] || ''}
                        onChange={e => handleSelect(depth, e.target.value)}
                    >
                        <option value="">{t('onboarding.selectUnit')}</option>
                        {options.map(u => (
                            <option key={u.id} value={u.id}>
                                {u.name}{u.type ? ` (${u.type})` : ''}
                            </option>
                        ))}
                    </Form.Select>
                </Form.Group>
            ))}

            {/* hints that guide the student to select deeper or warn if the unit isn't valid */}
            {finalUnit && hasChildren && (
                <p className="onboarding-hint">{t('onboarding.selectDeeper')}</p>
            )}
            {finalUnit && !hasChildren && !finalUnit.studentPickable && (
                <p className="onboarding-hint onboarding-hint-warn">{t('onboarding.notPickable')}</p>
            )}
            {isPickable && (
                <div className="onboarding-selected-unit">
                    ✓ {finalUnit.name}
                </div>
            )}
        </div>
    );
}

export default function OnboardingModal({ user, updateUser }) {
    const { t } = useTranslation();
    const isStudent = user?.UsersGroups?.name === 'STUDENT';
    // a student needs to pick their org unit; other users are new (userGroupId === 0)
    const needsSetup = !user?.orgUnitId;

    const [flatUnits, setFlatUnits] = useState([]);
    const [loadingUnits, setLoadingUnits] = useState(true);

    const [selectedUnitId, setSelectedUnitId] = useState(null);      // student's chosen year
    const [selectedWorkplaces, setSelectedWorkplaces] = useState([]); // employee's workplaces
    const [adminCode, setAdminCode] = useState('');
    const [wantsAdmin, setWantsAdmin] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        getOrgUnitsFlat()
            .then(res => setFlatUnits(res.data || []))
            .catch(() => setFlatUnits([]))
            .finally(() => setLoadingUnits(false));
    }, []);

    // toggle a workplace chip on/off
    const toggleWorkplace = (unitId) => {
        setSelectedWorkplaces(prev =>
            prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
        );
    };

    const handleSubmit = async () => {
        setError('');
        if (isStudent) {
            if (!selectedUnitId) { setError(t('onboarding.pickOrgUnitError')); return; }
        } else {
            if (!wantsAdmin && selectedWorkplaces.length === 0) { setError(t('onboarding.pickWorkplacesError')); return; }
        }
        setSaving(true);
        try {
            if (isStudent) {
                // students only set their primary org unit
                const res = await gsAxios.put('/users', { orgUnitId: selectedUnitId }, { withCredentials: true });
                updateUser(res.data.data);
            } else {
                // resolve the group id from name so we don't hard-code numeric IDs
                const groupRes = await gsAxios.get('/usersGroups', { withCredentials: true });
                const groups = groupRes.data.data || [];
                const groupName = wantsAdmin ? 'ADMIN' : 'EMPLOYEE';
                const group = groups.find(g => g.name === groupName);
                if (!group) { setError(t('onboarding.groupNotFound')); setSaving(false); return; }

                // update group + primary org unit in one request; admin code goes in the body
                const body = { userGroupId: group.id, orgUnitId: selectedWorkplaces[0] || null };
                if (wantsAdmin) body.adminCode = adminCode;

                const userRes = await gsAxios.put('/users', body, { withCredentials: true });

                // create a UserWorkplace record for each selected unit
                for (const unitId of selectedWorkplaces) {
                    await addWorkplace(unitId);
                }
                updateUser(userRes.data.data);
            }
        } catch (e) {
            setError(e?.response?.data?.data || t('onboarding.errorOccurred'));
        } finally {
            setSaving(false);
        }
    };

    // dismiss if setup is already done (handles stale render after updateUser)
    if (!needsSetup && user?.userGroupId !== 0) return null;

    return (
        <div className="onboarding-backdrop">
            <div className="onboarding-window">
                <h3 className="onboarding-title">
                    {isStudent ? t('onboarding.welcomeStudent') : t('onboarding.welcomeEmployee')}
                </h3>
                <p className="onboarding-subtitle">
                    {isStudent ? t('onboarding.pickOrgUnitHint') : t('onboarding.pickWorkplacesHint')}
                </p>

                {error && <div className="onboarding-error">{error}</div>}

                {loadingUnits ? (
                    <div className="onboarding-loading"><Spinner /></div>
                ) : isStudent ? (
                    // student flow: drill-down picker for year selection
                    <CascadingUnitPicker flatUnits={flatUnits} onSelect={setSelectedUnitId} />
                ) : (
                    // employee flow: chip list of all org units + optional admin upgrade
                    <>
                        <Form.Group className="mb-3">
                            <Form.Label>{t('onboarding.workplaces')}</Form.Label>
                            <div className="onboarding-chips-list">
                                {flatUnits.map(u => {
                                    const selected = selectedWorkplaces.includes(u.id);
                                    return (
                                        <button
                                            key={u.id}
                                            type="button"
                                            className={`onboarding-chip${selected ? ' selected' : ''}`}
                                            onClick={() => toggleWorkplace(u.id)}
                                        >
                                            {u.name}
                                            {u.type && <span className="onboarding-chip-type">{u.type}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                            {selectedWorkplaces.length > 0 && (
                                <div className="onboarding-selected-count">
                                    {t('onboarding.selectedCount', { count: selectedWorkplaces.length })}
                                </div>
                            )}
                        </Form.Group>

                        <div className="onboarding-admin-toggle">
                            <Form.Check
                                type="checkbox"
                                label={t('onboarding.iAmAdmin')}
                                checked={wantsAdmin}
                                onChange={e => setWantsAdmin(e.target.checked)}
                            />
                        </div>
                        {/* admin code input only appears when the user opts in */}
                        {wantsAdmin && (
                            <Form.Group className="mt-2">
                                <Form.Control
                                    type="password"
                                    placeholder={t('onboarding.adminCodePlaceholder')}
                                    value={adminCode}
                                    onChange={e => setAdminCode(e.target.value)}
                                />
                            </Form.Group>
                        )}
                    </>
                )}

                <Button
                    className="onboarding-submit"
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={saving || (isStudent && !selectedUnitId)}
                >
                    {saving ? <Spinner size="sm" /> : t('onboarding.confirm')}
                </Button>
            </div>
        </div>
    );
}
