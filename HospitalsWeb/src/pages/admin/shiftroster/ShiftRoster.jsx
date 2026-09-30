import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../util/api';
import WeeklyRoster from './WeeklyRoster';

export default function ShiftRoster({ user }) {
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const depts = await apiFetch('/hr/departments');
        setDepartments(Array.isArray(depts) ? depts : []);
      } catch {
        /* non-critical */
      }
    })();
  }, []);

  return <WeeklyRoster departments={departments} user={user} />;
}
