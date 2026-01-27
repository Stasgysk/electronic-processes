import { useEffect, useState, useRef } from "react";

export function useFormsLoader(user, fetchFunction, t, refreshKey) {
    const [forms, setForms] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [loadingError, setLoadingError] = useState(null);
    const hasLoadedRef = useRef(false);
    const fetchFunctionRef = useRef(fetchFunction);

    useEffect(() => {
        fetchFunctionRef.current = fetchFunction;
    }, [fetchFunction]);

    useEffect(() => {
        if (!user?.userGroupId) return;

        const fetchForms = async () => {
            try {
                const res = await fetchFunction(user.userGroupId);
                setForms(res.data || []);
                setLoaded(true);
            } catch (err) {
                console.error("Error loading forms:", err);
                setLoadingError(t("formsLoadingError"));
            }
        };

        fetchForms();
    }, [user?.userGroupId, t, refreshKey]);

    return { forms, loaded, loadingError };
}