import { useState, useEffect, memo } from "react";

const DecryptedText = ({ text }) => {
    return <span>{text}</span>;
};

export default memo(DecryptedText);
