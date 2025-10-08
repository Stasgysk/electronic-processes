import './GroupSelector.css'
import Form from 'react-bootstrap/Form';
import {useEffect, useState} from "react";
import {getUsersGroups} from "../api/usersGroups.service";
import {Button} from "react-bootstrap";

export default function GroupSelector(props) {
    const [usersGroups, setUsersGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState("");

    useEffect(() => {
        const fetchGroups = async () => {
            if (usersGroups.length === 0) {
                try {
                    const result = await getUsersGroups();
                    const groups = result.data;
                    setUsersGroups(groups);

                    if (groups.length > 0) {
                        setSelectedGroupId(groups[0].id);
                    }
                } catch (err) {
                    console.error("Failed to fetch groups:", err);
                }
            }
        };

        fetchGroups();
    }, [usersGroups]);

    const renderGroupOptions = () => {
        if (!usersGroups || usersGroups.length === 0) return null;

        return usersGroups.map(group => (
            <option key={group.id} value={group.id}>
                {group.name}
            </option>
        ));
    };

    const handleSelectChange = (e) => {
        setSelectedGroupId(e.target.value);
    }

    const submitGroup = async () => {
        props.updateUser({ ...props.user, userGroupId: Number(selectedGroupId) });
    }

    return (
        <div className="blur-background">
            <div className="group-selector-window">
                <div className="group-selector">
                    <h2>Choose you group</h2>
                    <Form.Select aria-label="Default select example" onChange={handleSelectChange}>
                        {renderGroupOptions()}
                    </Form.Select>
                    <Button variant="primary" type="submit" onClick={() => submitGroup()}>
                        Submit
                    </Button>
                </div>
            </div>
        </div>
    )
}