import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Form, InputGroup, Modal, Spinner, Badge } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { getOrgUnitsTree, getOrgUnitsFlat, createOrgUnit, updateOrgUnit, deleteOrgUnit, searchUsers, assignUserOrgUnit, cloneOrgUnit, getAllUsers, addUserWorkplace, removeUserWorkplace } from '../api/orgUnits.service';
import { getOrgRoles, createOrgRole, updateOrgRole, deleteOrgRole } from '../api/orgRoles.service';
import { assignUserToRole, removeUserFromRole } from '../api/userOrgRoles.service';
import { getSemesters, createSemester, deleteSemester, activateSemester, previewTransition, transitionStudents, copyProfessors } from '../api/semesters.service';
import { getAdminProcesses, updateProcessStatus } from '../api/processes.service';
import './AdminPage.css';

function TreeNode({ unit, selectedId, onSelect, onAddChild, onDelete, onClone, onTogglePickable, depth = 0 }) {
    const [expanded, setExpanded] = useState(depth < 2);
    const hasChildren = unit.children && unit.children.length > 0;
    const isSelected = selectedId === unit.id;

    return (
        <div className="tree-node">
            <div className={`tree-row${isSelected ? ' selected' : ''}`} onClick={() => onSelect(unit)}>
                {hasChildren
                    ? <span className="tree-toggle" onClick={e => { e.stopPropagation(); setExpanded(p => !p); }} style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                    : <span className="tree-toggle-leaf" />
                }
                <span className="tree-name">{unit.name}</span>
                {unit.type && <Badge bg="secondary" className="tree-badge">{unit.type}</Badge>}
                {unit.studentPickable && <span className="tree-pickable-badge" title="Students can pick this unit">🎓</span>}
                <span className="tree-actions">
                    <button className="tree-btn" title="Add child" onClick={e => { e.stopPropagation(); onAddChild(unit); }}>+</button>
                    <button className="tree-btn" title="Clone" onClick={e => { e.stopPropagation(); onClone(unit); }}>⧉</button>
                    <button
                        className={`tree-btn${unit.studentPickable ? ' active' : ''}`}
                        title="Toggle student pickable"
                        onClick={e => { e.stopPropagation(); onTogglePickable(unit); }}
                    >🎓</button>
                    <button className="tree-btn danger" title="Delete" onClick={e => { e.stopPropagation(); onDelete(unit); }}>×</button>
                </span>
            </div>
            {expanded && hasChildren && (
                <div className="tree-children">
                    {unit.children.map(child => (
                        <TreeNode key={child.id} unit={child} selectedId={selectedId}
                            onSelect={onSelect} onAddChild={onAddChild} onDelete={onDelete} onClone={onClone} onTogglePickable={onTogglePickable}
                            depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

function RoleCard({ role, onDelete, onUpdate }) {
    const { t } = useTranslation();
    const [assignments, setAssignments] = useState(role.UserOrgRoles || []);
    const [emailInput, setEmailInput] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [assigning, setAssigning] = useState(false);

    const [emailPattern, setEmailPattern] = useState(role.emailPattern || '');
    const [accessCode, setAccessCode] = useState(role.accessCode || '');
    const [showCode, setShowCode] = useState(false);
    const [roleSortOrder, setRoleSortOrder] = useState(role.sortOrder != null ? String(role.sortOrder) : '');
    const [saving, setSaving] = useState(false);

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            const parsedOrder = parseInt(roleSortOrder);
            const sortOrder = roleSortOrder.trim() !== '' && !isNaN(parsedOrder) ? parsedOrder : null;
            const updated = await updateOrgRole(role.id, { emailPattern: emailPattern || null, accessCode: accessCode || null, sortOrder });
            onUpdate(updated.data);
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleSearch = async () => {
        if (!emailInput.trim()) return;
        setSearching(true);
        try {
            const res = await searchUsers(emailInput.trim());
            setSearchResults(res.data || []);
        } catch {
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    };

    const handleAssign = async (user) => {
        setAssigning(true);
        try {
            const res = await assignUserToRole({ userId: user.id, orgRoleId: role.id });
            const newA = { ...res.data, User: user };
            setAssignments(prev => prev.some(a => a.userId === user.id) ? prev : [...prev, newA]);
            setEmailInput('');
            setSearchResults([]);
        } catch (e) {
            console.error(e);
        } finally {
            setAssigning(false);
        }
    };

    const handleRemove = async (a) => {
        try {
            await removeUserFromRole(a.id);
            setAssignments(prev => prev.filter(x => x.id !== a.id));
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="role-card">
            <div className="role-card-header">
                <span className="role-card-name">{role.name}</span>
                <button className="icon-btn danger" onClick={() => onDelete(role)} title={t('deleteRole')}>×</button>
            </div>

            <div className="role-card-section">
                <label className="role-field-label">{t('emailPattern')}</label>
                <InputGroup size="sm">
                    <Form.Control
                        value={emailPattern}
                        onChange={e => setEmailPattern(e.target.value)}
                        placeholder={t('emailPatternPlaceholder')}
                    />
                </InputGroup>
                <p className="role-field-hint">{t('emailPatternHint')}</p>
            </div>

            <div className="role-card-section">
                <label className="role-field-label">{t('accessCode')}</label>
                <InputGroup size="sm">
                    <Form.Control
                        type={showCode ? 'text' : 'password'}
                        value={accessCode}
                        onChange={e => setAccessCode(e.target.value)}
                        placeholder={t('accessCodePlaceholder')}
                    />
                    <Button variant="outline-secondary" onClick={() => setShowCode(p => !p)}>
                        {showCode ? '🙈' : '👁'}
                    </Button>
                </InputGroup>
                <p className="role-field-hint">{t('accessCodeHint')}</p>
            </div>

            {role.isStudentRole && (
                <div className="role-card-section">
                    <label className="role-field-label">{t('sortOrder')}</label>
                    <InputGroup size="sm">
                        <Form.Control
                            type="number"
                            min="1"
                            value={roleSortOrder}
                            onChange={e => setRoleSortOrder(e.target.value)}
                            placeholder={t('unitSortOrderPlaceholder')}
                        />
                    </InputGroup>
                    <p className="role-field-hint">{t('sortOrderHint')}</p>
                </div>
            )}

            <Button size="sm" variant="outline-primary" onClick={handleSaveSettings} disabled={saving} className="mb-3">
                {saving ? <Spinner size="sm" /> : t('saveSettings')}
            </Button>

            <div className="role-card-section">
                <label className="role-field-label">{t('assignedUsers')}</label>
                <div className="assignee-chips">
                    {assignments.length === 0
                        ? <span className="no-assignees">{t('noAssignees')}</span>
                        : assignments.map(a => (
                            <span key={a.id} className="assignee-chip">
                                {a.User ? a.User.email : `#${a.userId}`}
                                <button onClick={() => handleRemove(a)}>×</button>
                            </span>
                        ))
                    }
                </div>
            </div>

            <div className="role-card-section">
                <label className="role-field-label">{t('addAssignee')}</label>
                <InputGroup size="sm">
                    <Form.Control
                        placeholder={t('searchByEmail')}
                        value={emailInput}
                        onChange={e => setEmailInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <Button variant="outline-secondary" onClick={handleSearch} disabled={searching}>
                        {searching ? <Spinner size="sm" /> : t('search')}
                    </Button>
                </InputGroup>
                {searchResults.length > 0 && (
                    <div className="search-dropdown">
                        {searchResults.map(u => (
                            <div key={u.id} className="search-dropdown-item" onClick={() => handleAssign(u)}>
                                <span>{u.email}</span>
                                {u.name && <span className="user-name-hint">{u.name}</span>}
                                {assigning ? <Spinner size="sm" /> : <span className="assign-label">{t('assign')}</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function RolesPanel({ unit, onRefresh, onUnitUpdate }) {
    const { t } = useTranslation();
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleIsStudent, setNewRoleIsStudent] = useState(false);
    const [adding, setAdding] = useState(false);

    const loadRoles = useCallback(async () => {
        if (!unit) return;
        setLoading(true);
        try {
            const res = await getOrgRoles(unit.id);
            setRoles(res.data || []);
        } catch {
            setRoles([]);
        } finally {
            setLoading(false);
        }
    }, [unit]);

    useEffect(() => { loadRoles(); }, [loadRoles]);

    const handleAddRole = async () => {
        if (!newRoleName.trim()) return;
        setAdding(true);
        try {
            const res = await createOrgRole({ name: newRoleName.trim(), orgUnitId: unit.id, isStudentRole: newRoleIsStudent });
            setRoles(prev => [...prev, { ...res.data, UserOrgRoles: [] }]);
            setNewRoleName('');
            setNewRoleIsStudent(false);
        } catch (e) {
            console.error(e);
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteRole = async (role) => {
        if (!window.confirm(`${t('deleteRoleConfirm')} "${role.name}"?`)) return;
        try {
            await deleteOrgRole(role.id);
            setRoles(prev => prev.filter(r => r.id !== role.id));
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdateRole = (updatedRole) => {
        setRoles(prev => prev.map(r => r.id === updatedRole.id ? { ...r, ...updatedRole } : r));
    };

    if (!unit) {
        return (
            <div className="roles-empty">
                <div className="roles-empty-icon">🏛</div>
                <p>{t('selectUnitToManage')}</p>
            </div>
        );
    }

    return (
        <div className="roles-panel">
            <div className="roles-panel-title">
                <h4>{unit.name}</h4>
                {unit.type && <Badge bg="secondary">{unit.type}</Badge>}
            </div>

            <div className="add-role-bar">
                <InputGroup size="sm">
                    <Form.Control
                        placeholder={t('newRoleName')}
                        value={newRoleName}
                        onChange={e => setNewRoleName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddRole()}
                    />
                    <Button variant="primary" onClick={handleAddRole} disabled={adding}>
                        {adding ? <Spinner size="sm" /> : t('addRole')}
                    </Button>
                </InputGroup>
                <Form.Check
                    type="checkbox"
                    id="new-role-is-student"
                    label={t('isStudentRole')}
                    checked={newRoleIsStudent}
                    onChange={e => setNewRoleIsStudent(e.target.checked)}
                    className="add-role-student-check"
                />
            </div>

            {loading ? (
                <div className="loading-center"><Spinner /></div>
            ) : roles.length === 0 ? (
                <p className="no-content-hint">{t('noRolesDefined')}</p>
            ) : (
                <div className="roles-grid">
                    {roles.map(role => (
                        <RoleCard key={role.id} role={role} onDelete={handleDeleteRole} onUpdate={handleUpdateRole} />
                    ))}
                </div>
            )}
        </div>
    );
}

function buildUnitPath(unitId, flatUnits) {
    const path = [];
    let currentId = unitId;
    const visited = new Set();
    while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const unit = flatUnits.find(u => u.id === currentId);
        if (!unit) break;
        path.unshift(unit.name);
        currentId = unit.parentId;
    }
    // Skip root university node (first element) to keep it concise
    return path.length > 1 ? path.slice(1).join(' › ') : path.join(' › ');
}

function UserExpandedRow({ user, flatUnits, allRoles, onUpdate }) {
    const { t } = useTranslation();
    const [addRoleIds, setAddRoleIds] = useState(new Set());
    const [addUnitIds, setAddUnitIds] = useState(new Set());
    const [removeRoleAssignIds, setRemoveRoleAssignIds] = useState(new Set());
    const [removeWpIds, setRemoveWpIds] = useState(new Set());
    const [saving, setSaving] = useState(false);

    const userUnits = (user.UserWorkplaces || []).filter(wp => wp.OrgUnit);
    const userUnitIds = new Set([
        ...userUnits.map(wp => wp.orgUnitId),
        ...(user.orgUnitId ? [user.orgUnitId] : []),
    ]);

    const existingRoleIds = new Set((user.UserOrgRoles || []).map(r => r.orgRoleId));
    const availableRoles = allRoles.filter(r => userUnitIds.has(r.orgUnitId) && !existingRoleIds.has(r.id));
    const availableUnits = flatUnits.filter(u => !userUnitIds.has(u.id));

    const rolesByUnit = availableRoles.reduce((acc, r) => {
        if (!acc[r.orgUnitId]) acc[r.orgUnitId] = [];
        acc[r.orgUnitId].push(r);
        return acc;
    }, {});

    const toggle = (setter, id) => setter(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const handleSave = async () => {
        setSaving(true);
        try {
            for (const assignId of removeRoleAssignIds) {
                await removeUserFromRole(assignId);
                onUpdate(user.id, u => ({ ...u, UserOrgRoles: u.UserOrgRoles.filter(r => r.id !== assignId) }));
            }
            for (const wpId of removeWpIds) {
                await removeUserWorkplace(user.id, wpId);
                onUpdate(user.id, u => ({ ...u, UserWorkplaces: u.UserWorkplaces.filter(w => w.id !== wpId) }));
            }
            for (const roleId of addRoleIds) {
                const res = await assignUserToRole({ userId: user.id, orgRoleId: roleId });
                const role = allRoles.find(r => r.id === roleId);
                const newAssign = { ...res.data, OrgRole: role };
                onUpdate(user.id, u => ({
                    ...u,
                    UserOrgRoles: u.UserOrgRoles.some(r => r.id === newAssign.id) ? u.UserOrgRoles : [...u.UserOrgRoles, newAssign],
                }));
            }
            for (const unitId of addUnitIds) {
                const res = await addUserWorkplace(user.id, unitId);
                const wp = res.data;
                if (!wp.OrgUnit) wp.OrgUnit = flatUnits.find(u => u.id === unitId);
                onUpdate(user.id, u => ({
                    ...u,
                    UserWorkplaces: u.UserWorkplaces.some(w => w.id === wp.id) ? u.UserWorkplaces : [...u.UserWorkplaces, wp],
                }));
            }
            setAddRoleIds(new Set());
            setAddUnitIds(new Set());
            setRemoveRoleAssignIds(new Set());
            setRemoveWpIds(new Set());
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const hasChanges = addRoleIds.size || addUnitIds.size || removeRoleAssignIds.size || removeWpIds.size;

    return (
        <React.Fragment>
            <tr className="uap-expanded-row">
                <td colSpan={2} className="uap-exp-empty" />

                <td className="uap-exp-cell">
                    <div className="uap-exp-chips">
                        {(user.UserOrgRoles || []).length === 0 && <span className="uap-no-roles">—</span>}
                        {(user.UserOrgRoles || []).map(r => {
                            const staged = removeRoleAssignIds.has(r.id);
                            const roleUnit = flatUnits.find(u => u.id === r.OrgRole?.orgUnitId);
                            return (
                                <span
                                    key={r.id}
                                    className={`uap-role-chip removable${staged ? ' staged-remove' : ''}`}
                                    onClick={() => toggle(setRemoveRoleAssignIds, r.id)}
                                    title={staged ? (t('clickToCancel') || 'Klikni pre zrušenie') : (t('clickToRemove') || 'Klikni pre odobratie')}
                                >
                                    {r.OrgRole?.name || '?'}
                                    {roleUnit && <span className="uap-chip-unit"> · {roleUnit.name}</span>}
                                    <span className="uap-chip-rm">{staged ? '↩' : '×'}</span>
                                </span>
                            );
                        })}
                    </div>
                    {Object.keys(rolesByUnit).length > 0 && (
                        <div className="uap-exp-available">
                            {Object.entries(rolesByUnit).map(([unitId, roles]) => {
                                const unit = flatUnits.find(u => u.id === parseInt(unitId));
                                return (
                                    <div key={unitId} className="uap-exp-group">
                                        <span className="uap-exp-group-label">{unit?.name || unitId}</span>
                                        <div className="uap-exp-group-chips">
                                            {roles.map(r => (
                                                <span
                                                    key={r.id}
                                                    className={`uap-role-chip addable${addRoleIds.has(r.id) ? ' selected' : ''}`}
                                                    onClick={() => toggle(setAddRoleIds, r.id)}
                                                >
                                                    {addRoleIds.has(r.id) ? '✓' : '+'} {r.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {availableRoles.length === 0 && userUnitIds.size === 0 && (
                        <span className="uap-exp-hint">{t('assignUnitFirst') || 'Najprv priraď org. jednotku'}</span>
                    )}
                </td>

                <td className="uap-exp-cell">
                    <div className="uap-exp-chips">
                        {user.orgUnitId && (() => {
                            const primaryUnit = flatUnits.find(u => u.id === user.orgUnitId);
                            const fullPath = primaryUnit ? buildUnitPath(user.orgUnitId, flatUnits) : null;
                            return primaryUnit ? (
                                <span className="uap-unit-chip primary" title={fullPath}>
                                    {fullPath}
                                </span>
                            ) : null;
                        })()}
                        {userUnits.length === 0 && !user.orgUnitId && <span className="uap-no-roles">—</span>}
                        {userUnits.map(wp => {
                            const staged = removeWpIds.has(wp.id);
                            const wpPath = wp.OrgUnit ? buildUnitPath(wp.orgUnitId, flatUnits) : wp.OrgUnit?.name;
                            return (
                                <span
                                    key={wp.id}
                                    className={`uap-unit-chip removable${staged ? ' staged-remove' : ''}`}
                                    onClick={() => toggle(setRemoveWpIds, wp.id)}
                                    title={staged ? (t('clickToCancel') || 'Klikni pre zrušenie') : (t('clickToRemove') || 'Klikni pre odobratie')}
                                >
                                    {wpPath || wp.OrgUnit?.name}
                                    <span className="uap-chip-rm">{staged ? '↩' : '×'}</span>
                                </span>
                            );
                        })}
                    </div>
                    {availableUnits.length > 0 && (
                        <div className="uap-exp-available">
                            <div className="uap-exp-group-chips">
                                {availableUnits.map(u => (
                                    <span
                                        key={u.id}
                                        className={`uap-unit-chip addable${addUnitIds.has(u.id) ? ' selected' : ''}`}
                                        onClick={() => toggle(setAddUnitIds, u.id)}
                                    >
                                        {addUnitIds.has(u.id) ? '✓' : '+'} {u.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </td>
            </tr>

            <tr className="uap-exp-save-row">
                <td colSpan={4}>
                    <div className="uap-exp-save-bar">
                        <span className="uap-exp-save-hint">
                            {hasChanges ? (
                                [
                                    addRoleIds.size ? `+${addRoleIds.size} ${t('roles') || 'rol'}` : null,
                                    addUnitIds.size ? `+${addUnitIds.size} ${t('orgUnit') || 'jednotiek'}` : null,
                                    removeRoleAssignIds.size ? `-${removeRoleAssignIds.size} ${t('roles') || 'rol'}` : null,
                                    removeWpIds.size ? `-${removeWpIds.size} ${t('orgUnit') || 'jednotiek'}` : null,
                                ].filter(Boolean).join(' · ')
                            ) : (
                                <span style={{ color: '#bbb' }}>{t('noChanges') || 'Žiadne zmeny'}</span>
                            )}
                        </span>
                        <Button size="sm" variant="primary" disabled={!hasChanges || saving} onClick={handleSave}>
                            {saving ? <Spinner size="sm" /> : (t('save') || 'Uložiť')}
                        </Button>
                    </div>
                </td>
            </tr>
        </React.Fragment>
    );
}

function UserAssignmentsPanel({ flatUnits }) {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const [allRoles, setAllRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);

    const [filterEmail, setFilterEmail] = useState('');
    const [filterName, setFilterName] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterUnit, setFilterUnit] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [usersRes, rolesRes] = await Promise.all([getAllUsers(), getOrgRoles()]);
            setUsers(usersRes.data || []);
            setAllRoles(rolesRes.data || []);
        } catch {
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const updateUser = (userId, updater) => {
        setUsers(prev => prev.map(u => u.id === userId ? updater(u) : u));
    };

    const getUserUnitIds = (u) => {
        const ids = new Set();
        if (u.orgUnitId) ids.add(String(u.orgUnitId));
        (u.UserWorkplaces || []).forEach(wp => { if (wp.orgUnitId) ids.add(String(wp.orgUnitId)); });
        return ids;
    };

    const filtered = users.filter(u => {
        if (filterEmail && !u.email?.toLowerCase().includes(filterEmail.toLowerCase())) return false;
        if (filterName && !u.name?.toLowerCase().includes(filterName.toLowerCase())) return false;
        if (filterRole) {
            const hasRole = (u.UserOrgRoles || []).some(r => r.OrgRole?.name?.toLowerCase().includes(filterRole.toLowerCase()));
            if (!hasRole) return false;
        }
        if (filterUnit) {
            const unitIds = getUserUnitIds(u);
            if (filterUnit === '__none__') { if (unitIds.size > 0) return false; }
            else if (!unitIds.has(filterUnit)) return false;
        }
        return true;
    });

    const hasFilters = filterEmail || filterName || filterRole || filterUnit;

    return (
        <div className="user-assignments-panel">
            <div className="uap-header">
                <h4 className="panel-section-title">{t('assignOrgUnitToUsers')}</h4>
                <span className="uap-count">{filtered.length} / {users.length}</span>
                {hasFilters && (
                    <button className="uap-clear-btn" onClick={() => { setFilterEmail(''); setFilterName(''); setFilterRole(''); setFilterUnit(''); }}>
                        ✕ {t('clearFilters') || 'Zrušiť filtre'}
                    </button>
                )}
            </div>

            {loading ? (
                <div className="loading-center"><Spinner /></div>
            ) : (
                <div className="uap-table-wrap">
                    <table className="uap-table">
                        <thead>
                            <tr className="uap-thead-labels">
                                <th>{t('email') || 'E-mail'}</th>
                                <th>{t('name') || 'Meno'}</th>
                                <th>{t('roles') || 'Roly'}</th>
                                <th>{t('orgUnit') || 'Org. jednotky'}</th>
                            </tr>
                            <tr className="uap-thead-filters">
                                <th>
                                    <div className="uap-filter-wrap">
                                        <input className="uap-filter-input" value={filterEmail} onChange={e => setFilterEmail(e.target.value)} />
                                    </div>
                                </th>
                                <th>
                                    <div className="uap-filter-wrap">
                                        <input className="uap-filter-input" value={filterName} onChange={e => setFilterName(e.target.value)} />
                                    </div>
                                </th>
                                <th>
                                    <div className="uap-filter-wrap">
                                        <input className="uap-filter-input" value={filterRole} onChange={e => setFilterRole(e.target.value)} />
                                    </div>
                                </th>
                                <th>
                                    <select className="uap-filter-input" style={{ paddingLeft: '8px' }} value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                                        <option value="">— všetky —</option>
                                        <option value="__none__">bez jednotky</option>
                                        {flatUnits.map(u => (
                                            <option key={u.id} value={String(u.id)}>{u.name}</option>
                                        ))}
                                    </select>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={4} className="uap-empty">{t('noUsersFound') || 'Žiadni používatelia'}</td></tr>
                            ) : filtered.map(user => {
                                const roles = user.UserOrgRoles || [];
                                const workplaces = user.UserWorkplaces || [];
                                const isExpanded = expandedId === user.id;

                                const unitChips = workplaces
                                    .filter(wp => wp.OrgUnit)
                                    .map(wp => ({ id: `w-${wp.id}`, name: wp.OrgUnit.name }));
                                if (user.orgUnitId && !workplaces.some(wp => wp.orgUnitId === user.orgUnitId)) {
                                    const primaryUnit = flatUnits.find(u => u.id === user.orgUnitId);
                                    if (primaryUnit) unitChips.unshift({ id: `ou-${user.orgUnitId}`, name: primaryUnit.name });
                                }

                                return (
                                    <React.Fragment key={user.id}>
                                        <tr
                                            className={`uap-tr${isExpanded ? ' expanded' : ''}`}
                                            onClick={() => setExpandedId(isExpanded ? null : user.id)}
                                        >
                                            <td className="uap-td-email">
                                                <span className="uap-expand-arrow">{isExpanded ? '▾' : '▸'}</span>
                                                {user.email}
                                            </td>
                                            <td className="uap-td-name">{user.name || '—'}</td>
                                            <td className="uap-td-roles">
                                                {isExpanded ? <span className="uap-no-roles">▾</span> : roles.length === 0 ? <span className="uap-no-roles">—</span> : (
                                                    <div className="uap-roles">
                                                        {roles.map(r => (
                                                            <span key={r.id} className="uap-role-chip">{r.OrgRole?.name || '?'}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="uap-td-unit">
                                                {isExpanded ? null : unitChips.length === 0
                                                    ? <span className="uap-no-roles">—</span>
                                                    : (
                                                        <div className="uap-roles">
                                                            {unitChips.map(c => (
                                                                <span key={c.id} className="uap-unit-chip">{c.name}</span>
                                                            ))}
                                                        </div>
                                                    )
                                                }
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <UserExpandedRow
                                                user={user}
                                                flatUnits={flatUnits}
                                                allRoles={allRoles}
                                                onUpdate={updateUser}
                                            />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function AddUnitModal({ show, onHide, onAdd, parentUnit }) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [type, setType] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => { if (show) { setName(''); setType(''); } }, [show]);

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const body = { name: name.trim(), type: type.trim() || null, parentId: parentUnit ? parentUnit.id : null };
            const res = await createOrgUnit(body);
            onAdd(res.data);
            onHide();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title>
                    {parentUnit ? `${t('addChildUnit')} "${parentUnit.name}"` : t('addRootUnitTitle')}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form.Group className="mb-3">
                    <Form.Label>{t('unitName')} *</Form.Label>
                    <Form.Control value={name} onChange={e => setName(e.target.value)} placeholder={t('unitNamePlaceholder')} autoFocus />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>{t('unitType')} <small className="text-muted">({t('optional')})</small></Form.Label>
                    <Form.Control value={type} onChange={e => setType(e.target.value)} placeholder={t('unitTypePlaceholder')} />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>{t('cancel')}</Button>
                <Button variant="primary" onClick={handleSave} disabled={saving || !name.trim()}>
                    {saving ? <Spinner size="sm" /> : t('add')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

function CloneUnitModal({ show, onHide, onCloned, sourceUnit }) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => { if (show) setName(sourceUnit ? `${sourceUnit.name} (copy)` : ''); }, [show, sourceUnit]);

    const handleClone = async () => {
        if (!name.trim() || !sourceUnit) return;
        setSaving(true);
        try {
            const res = await cloneOrgUnit(sourceUnit.id, { name: name.trim(), type: sourceUnit.type, parentId: sourceUnit.parentId });
            onCloned(res.data);
            onHide();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title>{t('cloneUnit')}: "{sourceUnit?.name}"</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p className="text-muted" style={{ fontSize: '0.9rem' }}>{t('cloneUnitHint')}</p>
                <Form.Group>
                    <Form.Label>{t('newUnitName')} *</Form.Label>
                    <Form.Control value={name} onChange={e => setName(e.target.value)} autoFocus />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>{t('cancel')}</Button>
                <Button variant="primary" onClick={handleClone} disabled={saving || !name.trim()}>
                    {saving ? <Spinner size="sm" /> : t('clone')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

function SemesterPanel() {
    const { t } = useTranslation();
    const [semesters, setSemesters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', type: 'ZIMNY', academicYear: '', startDate: '', endDate: '' });
    const [saving, setSaving] = useState(false);
    const [fromSemesterId, setFromSemesterId] = useState('');
    const [previewFor, setPreviewFor] = useState(null);
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [transitioning, setTransitioning] = useState(false);
    const [copying, setCopying] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getSemesters();
            setSemesters(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        setSaving(true);
        try {
            await createSemester(form);
            setShowCreate(false);
            setForm({ name: '', type: 'ZIMNY', academicYear: '', startDate: '', endDate: '' });
            load();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleActivate = async (semester) => {
        if (!window.confirm(t('activateSemesterConfirm'))) return;
        try {
            await activateSemester(semester.id);
            load();
        } catch (e) {
            console.error(e);
        }
    };

    const handlePreview = async (toSemesterId) => {
        if (!fromSemesterId) return;
        setPreviewLoading(true);
        setPreviewFor(toSemesterId);
        try {
            const res = await previewTransition(toSemesterId, fromSemesterId);
            setPreview(res.data);
        } catch (e) {
            console.error(e);
            setPreview(null);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleTransitionStudents = async (toSemesterId) => {
        if (!fromSemesterId) return;
        if (!window.confirm(t('transitionStudentsConfirm'))) return;
        setTransitioning(true);
        try {
            await transitionStudents(toSemesterId, fromSemesterId);
            setPreview(null);
            setPreviewFor(null);
            load();
        } catch (e) {
            console.error(e);
        } finally {
            setTransitioning(false);
        }
    };

    const handleCopyProfessors = async (toSemesterId) => {
        if (!fromSemesterId) return;
        if (!window.confirm(t('copyProfessorsConfirm'))) return;
        setCopying(true);
        try {
            await copyProfessors(toSemesterId, fromSemesterId);
            load();
        } catch (e) {
            console.error(e);
        } finally {
            setCopying(false);
        }
    };

    const handleDelete = async (semester) => {
        if (!window.confirm(t('deleteSemesterConfirm'))) return;
        try {
            await deleteSemester(semester.id);
            load();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="semester-panel">
            <div className="semester-panel-header">
                <h4 className="panel-section-title">{t('semestres')}</h4>
                <Button size="sm" variant="outline-primary" onClick={() => setShowCreate(p => !p)}>
                    {t('createSemester')}
                </Button>
            </div>

            {showCreate && (
                <div className="semester-create-form">
                    <Form.Group className="mb-2">
                        <Form.Label>{t('semesterName')}</Form.Label>
                        <Form.Control size="sm" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Zimný 2025/26" />
                    </Form.Group>
                    <Form.Group className="mb-2">
                        <Form.Label>{t('semesterType')}</Form.Label>
                        <Form.Select size="sm" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                            <option value="ZIMNY">{t('zimny')}</option>
                            <option value="LETNY">{t('letny')}</option>
                        </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-2">
                        <Form.Label>{t('academicYear')}</Form.Label>
                        <Form.Control size="sm" value={form.academicYear} onChange={e => setForm(p => ({ ...p, academicYear: e.target.value }))} placeholder="2025/26" />
                    </Form.Group>
                    <Form.Group className="mb-2">
                        <Form.Label>{t('startDate')}</Form.Label>
                        <Form.Control size="sm" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
                    </Form.Group>
                    <Form.Group className="mb-2">
                        <Form.Label>{t('endDate')}</Form.Label>
                        <Form.Control size="sm" type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
                    </Form.Group>
                    <Button size="sm" variant="primary" onClick={handleCreate} disabled={saving || !form.name || !form.academicYear || !form.startDate || !form.endDate}>
                        {saving ? <Spinner size="sm" /> : t('create')}
                    </Button>
                </div>
            )}

            <div className="semester-transfer-bar">
                <span className="semester-transfer-label">{t('transferFrom')}</span>
                <Form.Select size="sm" value={fromSemesterId} onChange={e => { setFromSemesterId(e.target.value); setPreview(null); setPreviewFor(null); }}>
                    <option value="">— {t('selectSemester')} —</option>
                    {semesters.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </Form.Select>
            </div>

            {loading ? (
                <div className="loading-center"><Spinner /></div>
            ) : semesters.length === 0 ? (
                <p className="no-content-hint">{t('noSemestersYet')}</p>
            ) : (
                <div className="semester-list">
                    {semesters.map(s => (
                        <div key={s.id} className={`semester-card${s.isCurrent ? ' current' : ''}`}>
                            <div className="semester-card-top">
                                <div className="semester-card-info">
                                    <span className="semester-name">{s.name}</span>
                                    <Badge bg={s.type === 'ZIMNY' ? 'primary' : 'warning'} text={s.type === 'LETNY' ? 'dark' : undefined} className="semester-type-badge">{s.type}</Badge>
                                    {s.isCurrent && <Badge bg="success">{t('currentSemester')}</Badge>}
                                    <span className="semester-dates">{s.startDate} → {s.endDate}</span>
                                </div>
                                <div className="semester-card-actions">
                                    {!s.isCurrent && (
                                        <Button size="sm" variant="outline-success" onClick={() => handleActivate(s)}>
                                            {t('activate')}
                                        </Button>
                                    )}
                                    {fromSemesterId && String(fromSemesterId) !== String(s.id) && (
                                        <>
                                            <Button size="sm" variant="outline-secondary" onClick={() => handlePreview(s.id)} disabled={previewLoading}>
                                                {previewLoading && previewFor === s.id ? <Spinner size="sm" /> : t('previewTransition')}
                                            </Button>
                                            <Button size="sm" variant="outline-primary" onClick={() => handleTransitionStudents(s.id)} disabled={transitioning}>
                                                {transitioning ? <Spinner size="sm" /> : t('transitionStudents')}
                                            </Button>
                                            <Button size="sm" variant="outline-secondary" onClick={() => handleCopyProfessors(s.id)} disabled={copying}>
                                                {copying ? <Spinner size="sm" /> : t('copyProfessors')}
                                            </Button>
                                        </>
                                    )}
                                    {!s.isCurrent && (
                                        <Button size="sm" variant="outline-danger" onClick={() => handleDelete(s)}>×</Button>
                                    )}
                                </div>
                            </div>
                            {previewFor === s.id && preview && (
                                <div className="semester-preview">
                                    <span>{t('isYearTransition')}: <strong>{preview.isYearTransition ? t('yes') : t('no')}</strong></span>
                                    <span>{t('studentsTransitioning')}: <strong>{preview.studentsTransitioning}</strong></span>
                                    <span>{t('studentsGraduating')}: <strong>{preview.studentsGraduating}</strong></span>
                                    <span>{t('professorsTotal')}: <strong>{preview.professorsTotal}</strong></span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ProcessesPanel() {
    const { t } = useTranslation();
    const [processes, setProcesses] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getAdminProcesses();
            setProcesses(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleStatus = async (id, status) => {
        if (status === 'deleted' && !window.confirm(t('deleteProcessConfirm'))) return;
        try {
            await updateProcessStatus(id, status);
            load();
        } catch (e) {
            console.error(e);
        }
    };

    const statusBadge = (status) => {
        if (status === 'published') return <Badge bg="success">{t('published')}</Badge>;
        if (status === 'deleted') return <Badge bg="danger">{t('deleted')}</Badge>;
        return <Badge bg="secondary">{t('hidden')}</Badge>;
    };

    if (loading) return <div className="loading-center"><Spinner /></div>;

    return (
        <div className="processes-panel">
            {processes.length === 0 ? (
                <p className="no-content-hint">{t('noProcesses')}</p>
            ) : (
                <table className="processes-table">
                    <thead>
                        <tr>
                            <th>{t('processName')}</th>
                            <th>{t('processGroup')}</th>
                            <th>{t('processType')}</th>
                            <th>{t('processStatus')}</th>
                            <th>{t('submissions')}</th>
                            <th>{t('awaiting')}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {processes.map(p => (
                            <tr key={p.id}>
                                <td>{p.name}</td>
                                <td>{p.processGroup?.name || '—'}</td>
                                <td>{p.processType?.name || '—'}</td>
                                <td>{statusBadge(p.status)}</td>
                                <td>{p.submissionsCount}</td>
                                <td>{p.awaitingCount}</td>
                                <td className="processes-actions">
                                    {p.status !== 'published' && p.deletedAt === null && (
                                        <Button size="sm" variant="outline-success" onClick={() => handleStatus(p.id, 'published')}>
                                            {t('publish')}
                                        </Button>
                                    )}
                                    {p.status === 'published' && (
                                        <Button size="sm" variant="outline-secondary" onClick={() => handleStatus(p.id, 'unpublished')}>
                                            {t('hide')}
                                        </Button>
                                    )}
                                    <Button size="sm" variant="outline-danger" onClick={() => handleStatus(p.id, 'deleted')}>
                                        {t('deleteProcess')}
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default function AdminPage() {
    const { t } = useTranslation();
    const [tree, setTree] = useState([]);
    const [flatUnits, setFlatUnits] = useState([]);
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('org');

    const [showAddModal, setShowAddModal] = useState(false);
    const [addParent, setAddParent] = useState(null);
    const [showCloneModal, setShowCloneModal] = useState(false);
    const [cloneSource, setCloneSource] = useState(null);

    const isInitialLoad = useRef(true);

    const loadTree = useCallback(async () => {
        if (isInitialLoad.current) setLoading(true);
        try {
            const [treeRes, flatRes] = await Promise.all([getOrgUnitsTree(), getOrgUnitsFlat()]);
            setTree(treeRes.data || []);
            setFlatUnits(flatRes.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            isInitialLoad.current = false;
        }
    }, []);

    useEffect(() => { loadTree(); }, [loadTree]);

    const handleDeleteUnit = async (unit) => {
        if (!window.confirm(t('deleteUnitConfirm'))) return;
        try {
            await deleteOrgUnit(unit.id);
            if (selectedUnit?.id === unit.id) setSelectedUnit(null);
            loadTree();
        } catch (e) {
            console.error(e);
        }
    };

    const handleTogglePickable = async (unit) => {
        try {
            await updateOrgUnit(unit.id, { studentPickable: !unit.studentPickable });
            loadTree();
        } catch (e) {
            console.error(e);
        }
    };

    const handleUnitUpdate = (updatedUnit) => {
        setSelectedUnit(prev => prev ? { ...prev, ...updatedUnit } : prev);
        loadTree();
    };

    return (
        <div className="admin-page">
            <div className="admin-topbar">
                <h3>{t('adminPanel')}</h3>
                <div className="admin-tabs">
                    {[['org', 'orgStructureRoles'], ['users', 'userAssignments'], ['semesters', 'semestres'], ['processes', 'processManagement']].map(([key, label]) => (
                        <button key={key} className={`admin-tab${activeTab === key ? ' active' : ''}`} onClick={() => setActiveTab(key)}>
                            {t(label)}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'org' && (
                <div className="admin-layout">
                    <aside className="tree-sidebar">
                        <div className="tree-sidebar-header">
                            <span className="tree-sidebar-title">{t('organizationalTree')}</span>
                            <Button size="sm" variant="outline-primary" onClick={() => { setAddParent(null); setShowAddModal(true); }}>
                                {t('addRootUnit')}
                            </Button>
                        </div>
                        <div className="tree-scroll">
                            {loading ? (
                                <div className="loading-center"><Spinner /></div>
                            ) : tree.length === 0 ? (
                                <p className="no-content-hint">{t('noUnitsYet')}</p>
                            ) : (
                                tree.map(unit => (
                                    <TreeNode
                                        key={unit.id}
                                        unit={unit}
                                        selectedId={selectedUnit?.id}
                                        onSelect={setSelectedUnit}
                                        onAddChild={u => { setAddParent(u); setShowAddModal(true); }}
                                        onDelete={handleDeleteUnit}
                                        onClone={u => { setCloneSource(u); setShowCloneModal(true); }}
                                        onTogglePickable={handleTogglePickable}
                                        depth={0}
                                    />
                                ))
                            )}
                        </div>
                    </aside>

                    <main className="roles-main">
                        <RolesPanel unit={selectedUnit} onRefresh={loadTree} onUnitUpdate={handleUnitUpdate} />
                    </main>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="admin-layout single">
                    <UserAssignmentsPanel flatUnits={flatUnits} />
                </div>
            )}

            {activeTab === 'semesters' && (
                <div className="admin-layout single">
                    <SemesterPanel />
                </div>
            )}

            {activeTab === 'processes' && (
                <div className="admin-layout single">
                    <ProcessesPanel />
                </div>
            )}

            <AddUnitModal
                show={showAddModal}
                onHide={() => setShowAddModal(false)}
                onAdd={loadTree}
                parentUnit={addParent}
            />
            <CloneUnitModal
                show={showCloneModal}
                onHide={() => setShowCloneModal(false)}
                onCloned={loadTree}
                sourceUnit={cloneSource}
            />
        </div>
    );
}
