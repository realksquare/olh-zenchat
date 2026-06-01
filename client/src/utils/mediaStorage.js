const MAX_RECENTS = 6;
const MAX_FAVS = 18;

const getUrl = (item) => item?.url || item?.images?.fixed_height?.url || '';

export const getFavMedia = () => {
    try {
        return JSON.parse(localStorage.getItem('zenchat_fav_media')) || [];
    } catch {
        return [];
    }
};

export const getRecentMedia = () => {
    try {
        return JSON.parse(localStorage.getItem('zenchat_recent_media')) || [];
    } catch {
        return [];
    }
};

export const addFavMedia = (item) => {
    let favs = getFavMedia();
    const itemUrl = getUrl(item);
    if (!itemUrl) return;
    favs = favs.filter(i => getUrl(i) !== itemUrl);
    favs.unshift(item);
    if (favs.length > MAX_FAVS) favs = favs.slice(0, MAX_FAVS);
    localStorage.setItem('zenchat_fav_media', JSON.stringify(favs));
};

export const removeFavMedia = (url) => {
    if (!url) return;
    let favs = getFavMedia();
    favs = favs.filter(i => getUrl(i) !== url);
    localStorage.setItem('zenchat_fav_media', JSON.stringify(favs));
};

export const addRecentMedia = (item) => {
    let recents = getRecentMedia();
    const itemUrl = getUrl(item);
    if (!itemUrl) return;
    recents = recents.filter(i => getUrl(i) !== itemUrl);
    recents.unshift(item);
    if (recents.length > MAX_RECENTS) recents = recents.slice(0, MAX_RECENTS);
    localStorage.setItem('zenchat_recent_media', JSON.stringify(recents));
};
