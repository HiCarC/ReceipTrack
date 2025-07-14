import React, { createContext, useContext, useState } from 'react';

const GroupContext = createContext();

export function useGroup() {
  return useContext(GroupContext);
}

export function GroupProvider({ children }) {
  // List of group members (simple names for now)
  const [members, setMembers] = useState([]);
  // Item assignments: { itemIndex: memberName }
  const [assignments, setAssignments] = useState({});

  // Add a new member
  const addMember = (name) => {
    if (!members.includes(name)) {
      setMembers([...members, name]);
    }
  };

  // Remove a member
  const removeMember = (name) => {
    setMembers(members.filter((m) => m !== name));
    // Remove assignments for this member
    setAssignments((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        if (updated[key] === name) delete updated[key];
      });
      return updated;
    });
  };

  // Assign an item to a member
  const assignItem = (itemIndex, memberName) => {
    setAssignments((prev) => ({ ...prev, [itemIndex]: memberName }));
  };

  // Clear all group data
  const clearGroup = () => {
    setMembers([]);
    setAssignments({});
  };

  const value = {
    members,
    addMember,
    removeMember,
    assignments,
    assignItem,
    clearGroup,
    setMembers,
    setAssignments,
  };

  return (
    <GroupContext.Provider value={value}>
      {children}
    </GroupContext.Provider>
  );
} 