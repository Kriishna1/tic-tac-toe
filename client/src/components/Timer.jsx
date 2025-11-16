import React, { useState, useEffect } from 'react';

function Timer({ startTime, timeLimit, onTimeout }) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);

  useEffect(() => {
    if (timeLimit === 0) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, timeLimit - elapsed);
      setTimeLeft(remaining);

      if (remaining === 0) {
        onTimeout();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [startTime, timeLimit, onTimeout]);

  if (timeLimit === 0) return null;

  const seconds = Math.ceil(timeLeft / 1000);
  const percentage = (timeLeft / timeLimit) * 100;
  const isLow = percentage < 30;

  return (
    <div className="timer-container">
      <div className="timer-label">Time Remaining</div>
      <div className={`timer-display ${isLow ? 'warning' : ''}`}>
        {seconds}s
      </div>
      <div className="timer-bar">
        <div
          className={`timer-progress ${isLow ? 'warning' : ''}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

export default Timer;
