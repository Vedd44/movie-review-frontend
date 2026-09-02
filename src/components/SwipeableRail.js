import { useRef, useState } from "react";

function SwipeableRail({ className = "", ariaLabel = "Movies", children }) {
  const railRef = useRef(null);
  const dragState = useRef({ active: false, startX: 0, startScrollLeft: 0, moved: false });
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (event) => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    const rail = railRef.current;
    if (!rail || rail.scrollWidth <= rail.clientWidth) return;
    dragState.current = { active: true, startX: event.clientX, startScrollLeft: rail.scrollLeft, moved: false };
    setDragging(true);
    rail.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const rail = railRef.current;
    const drag = dragState.current;
    if (!rail || !drag.active) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 5) drag.moved = true;
    rail.scrollLeft = drag.startScrollLeft - distance;
  };

  const endDrag = (event) => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    setDragging(false);
    if (railRef.current?.hasPointerCapture(event.pointerId)) railRef.current.releasePointerCapture(event.pointerId);
  };

  const handleClickCapture = (event) => {
    if (dragState.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      dragState.current.moved = false;
    }
  };

  const handleWheel = (event) => {
    const rail = railRef.current;
    if (!rail || rail.scrollWidth <= rail.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    event.preventDefault();
    rail.scrollLeft += event.deltaY;
  };

  const handleKeyDown = (event) => {
    if (!railRef.current || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    railRef.current.scrollBy({ left: event.key === "ArrowRight" ? 220 : -220, behavior: "smooth" });
  };

  return (
    <div
      ref={railRef}
      className={`${className}${dragging ? " is-dragging" : ""}`}
      aria-label={ariaLabel}
      tabIndex="0"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={handleClickCapture}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

export default SwipeableRail;
