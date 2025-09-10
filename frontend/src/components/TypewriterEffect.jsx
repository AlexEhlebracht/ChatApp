import React, { useEffect, useState } from "react";
import "../styles/TypewriterEffect.css";

const TypewriterEffect = () => {
  const text = "Chat App";
  const [displayText, setDisplayText] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(
        () => {
          setDisplayText((prev) => [...prev, text[index]]);
          setIndex((prev) => prev + 1);
        },
        index === 0 ? 400 : 200
      ); // Longer pause for space
      return () => clearTimeout(timeout);
    } else {
      const loopTimeout = setTimeout(() => {
        setDisplayText([]);
        setIndex(0);
      }, 5000); // Loop after 5 seconds
      return () => clearTimeout(loopTimeout);
    }
  }, [index]);

  return (
    <div className="form-header">
      {displayText.map((char, i) => (
        <span key={i} className="letter">
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
      <span className="cursor" />
    </div>
  );
};

export default TypewriterEffect;
