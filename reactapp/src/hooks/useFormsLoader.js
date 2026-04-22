// Shared hook that fetches a list of forms / form instances for the home page tabs.
//
// Used three times in App.js — once per tab (available, awaiting, filled).
// Each call gets a different fetchFunction but the loading/error/data lifecycle is identical.
//
// refreshKey is an integer bumped by App.js after a form submission; changing it causes
// the effect to re-run and the list to reload without remounting the component.
//
// fetchFunctionRef stores the latest fetchFunction in a ref so the effect's stable
// dependency array ([user?.id, t, refreshKey]) doesn't need the function itself —
// avoids infinite loops if the caller passes an inline arrow function.

import { useEffect, useState, useRef } from "react";

export function useFormsLoader(user, fetchFunction, t, refreshKey) {
    const [forms, setForms] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [loadingError, setLoadingError] = useState(null);
    const hasLoadedRef = useRef(false);
    const fetchFunctionRef = useRef(fetchFunction);

    // keep the ref current so the effect always calls the latest version of fetchFunction
    useEffect(() => {
        fetchFunctionRef.current = fetchFunction;
    }, [fetchFunction]);

    useEffect(() => {
        if (!user) return;

        const fetchForms = async () => {
            try {
                const res = await fetchFunction();
                setForms(res.data || []);
                setLoaded(true);
            } catch (err) {
                console.error("Error loading forms:", err);
                setLoadingError(t("formsLoadingError"));
            }
        };

        fetchForms();
    }, [user?.id, t, refreshKey]); // refreshKey re-triggers after form submission

    return { forms, loaded, loadingError };
}
