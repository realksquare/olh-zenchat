const MAX_ITEMS = 21;

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
    favs = favs.filter(i => i.url !== item.url);
    favs.unshift(item);
    if (favs.length > MAX_ITEMS) favs.pop();
    localStorage.setItem('zenchat_fav_media', JSON.stringify(favs));
};

export const removeFavMedia = (url) => {
    let favs = getFavMedia();
    favs = favs.filter(i => i.url !== url);
    localStorage.setItem('zenchat_fav_media', JSON.stringify(favs));
};

export const addRecentMedia = (item) => {
    let recents = getRecentMedia();
    recents = recents.filter(i => i.url !== item.url);
    recents.unshift(item);
    if (recents.length > MAX_ITEMS) recents.pop();
    localStorage.setItem('zenchat_recent_media', JSON.stringify(recents));
};
