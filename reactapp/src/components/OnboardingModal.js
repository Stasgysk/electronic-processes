import './OnboardingModal.css';
import { useState, useEffect } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { getOrgUnitsFlat } from '../api/orgUnits.service';
import { addWorkplace } from '../api/userWorkplaces.service';
import gsAxios from '../api/gsAxios';

function CascadingUnitPicker({ flatUnits, onSelect }) {
    const { t } = useTranslation();
    const [path, setPath] = useState([]);

    const getOptions = (depth) => {
        if (depth === 0) {
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
        const newPath = path.slice(0, depth);
        if (unitId) newPath.push(unitId);
        setPath(newPath);

        const finalUnit = unitId ? flatUnits.find(u => u.id === unitId) : null;
        const children = unitId ? flatUnits.filter(u => u.parentId === unitId) : [];
        onSelect(finalUnit?.studentPickable && children.length === 0 ? unitId : null);
    };

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
    const needsSetup = !user?.orgUnitId;

    const [flatUnits, setFlatUnits] = useState([]);
    const [loadingUnits, setLoadingUnits] = useState(true);

    const [selectedUnitId, setSelectedUnitId] = useState(null);
    const [selectedWorkplaces, setSelectedWorkplaces] = useState([]);
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
                const res = await gsAxios.put('/users', { orgUnitId: selectedUnitId }, { withCredentials: true });
                updateUser(res.data.data);
            } else {
                const groupRes = await gsAxios.get('/usersGroups', { withCredentials: true });
                const groups = groupRes.data.data || [];
                const groupName = wantsAdmin ? 'ADMIN' : 'EMPLOYEE';
                const group = groups.find(g => g.name === groupName);
                if (!group) { setError(t('onboarding.groupNotFound')); setSaving(false); return; }

                const body = { userGroupId: group.id, orgUnitId: selectedWorkplaces[0] || null };
                if (wantsAdmin) body.adminCode = adminCode;

                const userRes = await gsAxios.put('/users', body, { withCredentials: true });

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
                    <CascadingUnitPicker flatUnits={flatUnits} onSelect={setSelectedUnitId} />
                ) : (
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
