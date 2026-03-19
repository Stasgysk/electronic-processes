import './OnboardingModal.css';
import { useState, useEffect } from 'react';
import { Form, Button, Spinner, Badge } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { getOrgUnitsFlat } from '../api/orgUnits.service';
import { addWorkplace } from '../api/userWorkplaces.service';
import gsAxios from '../api/gsAxios';

export default function OnboardingModal({ user, updateUser }) {
    const { t } = useTranslation();
    const isStudent = user?.UsersGroups?.name === 'STUDENT';
    const needsSetup = !user?.orgUnitId;

    const [flatUnits, setFlatUnits] = useState([]);
    const [loadingUnits, setLoadingUnits] = useState(true);

    const [selectedFaculty, setSelectedFaculty] = useState('');
    const [selectedWorkplaces, setSelectedWorkplaces] = useState([]);
    const [adminCode, setAdminCode] = useState('');
    const [wantsAdmin, setWantsAdmin] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        getOrgUnitsFlat()
            .then(res => {
                const all = res.data || [];
                setFlatUnits(isStudent ? all.filter(u => u.studentPickable) : all);
            })
            .catch(() => setFlatUnits([]))
            .finally(() => setLoadingUnits(false));
    }, [isStudent]);

    const toggleWorkplace = (unitId) => {
        setSelectedWorkplaces(prev =>
            prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
        );
    };

    const handleSubmit = async () => {
        setError('');
        if (isStudent) {
            if (!selectedFaculty) { setError(t('onboarding.pickFacultyError')); return; }
        } else {
            if (!wantsAdmin && selectedWorkplaces.length === 0) { setError(t('onboarding.pickWorkplacesError')); return; }
        }
        setSaving(true);
        try {
            if (isStudent) {
                const res = await gsAxios.put('/users', { orgUnitId: parseInt(selectedFaculty) }, { withCredentials: true });
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
                    {isStudent ? t('onboarding.pickFacultyHint') : t('onboarding.pickWorkplacesHint')}
                </p>

                {error && <div className="onboarding-error">{error}</div>}

                {loadingUnits ? (
                    <div className="onboarding-loading"><Spinner /></div>
                ) : isStudent ? (
                    <Form.Group>
                        <Form.Label column={}>{t('onboarding.faculty')}</Form.Label>
                        <Form.Select value={selectedFaculty} onChange={e => setSelectedFaculty(e.target.value)}>
                            <option value="">{t('onboarding.selectFaculty')}</option>
                            {flatUnits.map(u => (
                                <option key={u.id} value={u.id}>{u.name}{u.type ? ` (${u.type})` : ''}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                ) : (
                    <>
                        <Form.Group className="mb-3">
                            <Form.Label column={}>{t('onboarding.workplaces')}</Form.Label>
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
                    disabled={saving}
                >
                    {saving ? <Spinner size="sm" /> : t('onboarding.confirm')}
                </Button>
            </div>
        </div>
    );
}
