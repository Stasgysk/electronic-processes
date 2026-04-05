import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Button, Form, InputGroup, Spinner } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useUser } from '../contexts/UserContext';
import { getMyRoles, joinRole, removeUserFromRole } from '../api/userOrgRoles.service';
import { getBrowseableRoles } from '../api/orgRoles.service';
import './ProfilePage.css';

function MyRoleChip({ assignment, onLeave }) {
    const { t } = useTranslation();
    const role = assignment.OrgRole;
    const unit = role?.OrgUnit;
    return (
        <div className="my-role-chip">
            <div className="my-role-info">
                <span className="my-role-name">{role?.name}</span>
                {unit && <span className="my-role-unit">{unit.name}{unit.type ? ` · ${unit.type}` : ''}</span>}
            </div>
            <button className="my-role-leave" onClick={() => onLeave(assignment)} title={t('profile.leaveRole')}>×</button>
        </div>
    );
}

function JoinRoleForm({ browseRoles, myRoleIds, onJoined }) {
    const { t } = useTranslation();
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [code, setCode] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const availableRoles = browseRoles.filter(r => !myRoleIds.has(r.id));
    const selectedRole = browseRoles.find(r => r.id === parseInt(selectedRoleId));

    const handleJoin = async () => {
        if (!selectedRoleId) return;
        setError('');
        setSuccess('');
        setSaving(true);
        try {
            const res = await joinRole(parseInt(selectedRoleId), code);
            onJoined(res.data, selectedRole);
            setSuccess(t('profile.joinSuccess', { role: selectedRole?.name }));
            setSelectedRoleId('');
            setCode('');
        } catch (e) {
            setError(e?.response?.data?.data || t('profile.joinError'));
        } finally {
            setSaving(false);
        }
    };

    const needsCode = selectedRole ? selectedRole.hasCode : true;

    return (
        <div className="join-role-form">
            <Form.Group className="mb-2">
                <Form.Label className="join-role-label">{t('profile.selectRole')}</Form.Label>
                <Form.Select
                    value={selectedRoleId}
                    onChange={e => { setSelectedRoleId(e.target.value); setError(''); setSuccess(''); }}
                    size="sm"
                >
                    <option value="">{t('profile.selectRolePlaceholder')}</option>
                    {Object.values(
                        availableRoles.reduce((acc, r) => {
                            const key = r.orgUnitId;
                            if (!acc[key]) acc[key] = { label: r.OrgUnit?.name || t('profile.unknownUnit'), roles: [] };
                            acc[key].roles.push(r);
                            return acc;
                        }, {})
                    ).map(({ label, roles }) => (
                        <optgroup key={label} label={label}>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>
                                    {r.name}{r.hasCode ? '' : ` (${t('profile.noCodeShort')})`}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </Form.Select>
            </Form.Group>

            {selectedRoleId && needsCode && (
                <Form.Group className="mb-2">
                    <Form.Label className="join-role-label">{t('profile.accessCode')}</Form.Label>
                    <InputGroup size="sm">
                        <Form.Control
                            type="password"
                            placeholder={t('profile.enterCode')}
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleJoin()}
                        />
                        <Button
                            variant="primary"
                            onClick={handleJoin}
                            disabled={saving || !code.trim()}
                        >
                            {saving ? <Spinner size="sm" /> : t('profile.join')}
                        </Button>
                    </InputGroup>
                </Form.Group>
            )}
            {selectedRoleId && !needsCode && (
                <p className="join-role-hint">{t('profile.contactAdminHint')}</p>
            )}

            {error && <div className="join-role-error">{error}</div>}
            {success && <div className="join-role-success">{success}</div>}
        </div>
    );
}

export default function ProfilePage() {
    const { t } = useTranslation();
    const { user } = useUser();

    const [myAssignments, setMyAssignments] = useState([]);
    const [browseRoles, setBrowseRoles] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [myRes, browseRes] = await Promise.all([getMyRoles(), getBrowseableRoles()]);
            setMyAssignments(myRes.data || []);
            setBrowseRoles(browseRes.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleLeave = async (assignment) => {
        if (!window.confirm(t('profile.leaveConfirm'))) return;
        try {
            await removeUserFromRole(assignment.id);
            setMyAssignments(prev => prev.filter(a => a.id !== assignment.id));
        } catch (e) {
            console.error(e);
        }
    };

    const handleJoined = (newAssignment, role) => {
        setMyAssignments(prev => [...prev, { ...newAssignment, OrgRole: role }]);
    };

    const myRoleIds = new Set(myAssignments.map(a => a.orgRoleId));

    return (
        <div className="profile-page">
            <div className="profile-header">
                <div className="profile-avatar">{user?.name?.[0]?.toUpperCase() || '?'}</div>
                <div className="profile-identity">
                    <h3 className="profile-name">{user?.name}</h3>
                    <p className="profile-email">{user?.email}</p>
                    {user?.UsersGroups?.name && (
                        <Badge bg={user.UsersGroups.name === 'ADMIN' ? 'danger' : user.UsersGroups.name === 'STUDENT' ? 'info' : 'secondary'}>
                            {user.UsersGroups.name}
                        </Badge>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="profile-loading"><Spinner /></div>
            ) : (
                <div className="profile-body">
                    <section className="profile-section">
                        <h4 className="profile-section-title">{t('profile.myRoles')}</h4>
                        {myAssignments.length === 0 ? (
                            <p className="profile-empty">{t('profile.noRoles')}</p>
                        ) : (
                            <div className="my-roles-list">
                                {myAssignments.map(a => (
                                    <MyRoleChip key={a.id} assignment={a} onLeave={handleLeave} />
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="profile-section">
                        <h4 className="profile-section-title">{t('profile.joinRole')}</h4>
                        <p className="profile-section-hint">{t('profile.joinRoleHint')}</p>
                        {browseRoles.length === 0 ? (
                            <p className="profile-empty">{t('profile.noRolesAvailable')}</p>
                        ) : (
                            <JoinRoleForm
                                browseRoles={browseRoles}
                                myRoleIds={myRoleIds}
                                onJoined={handleJoined}
                            />
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
