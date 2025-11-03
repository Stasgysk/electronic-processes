import { useEffect, useState, useCallback } from "react";

export function useFormsLoader(user, fetchFunction, t) {
    const [forms, setForms] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [loadingError, setLoadingError] = useState(null);

    const fetchForms = useCallback(async () => {
        if (!user?.userGroupId || loaded) return;

        try {
            const res = await fetchFunction(user.userGroupId);
            setForms(res.data || []);
            setLoaded(true);
        } catch (err) {
            console.error("Error loading forms:", err);
            setLoadingError(t("formsLoadingError"));
        }
    }, [user?.userGroupId, loaded, fetchFunction, t]);

    useEffect(() => {
        fetchForms();
    }, [fetchForms]);

    return { forms, loaded, loadingError };
}
