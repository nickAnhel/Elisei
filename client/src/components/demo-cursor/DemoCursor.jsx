import { useEffect, useRef, useState } from "react";

import "./DemoCursor.css";


function DemoCursor() {
    const [cursorState, setCursorState] = useState({
        x: 0,
        y: 0,
        visible: false,
    });
    const [ripples, setRipples] = useState([]);
    const rippleIdRef = useRef(0);

    useEffect(() => {
        let mounted = true;

        const handlePointerMove = (event) => {
            if (!mounted) {
                return;
            }

            setCursorState({
                x: event.clientX,
                y: event.clientY,
                visible: true,
            });
        };

        const handlePointerLeave = () => {
            if (!mounted) {
                return;
            }

            setCursorState((prevState) => ({
                ...prevState,
                visible: false,
            }));
        };

        const handlePointerDown = (event) => {
            if (!mounted) {
                return;
            }

            const rippleId = rippleIdRef.current + 1;
            rippleIdRef.current = rippleId;

            setCursorState({
                x: event.clientX,
                y: event.clientY,
                visible: true,
            });
            setRipples((prevRipples) => [
                ...prevRipples,
                {
                    id: rippleId,
                    x: event.clientX,
                    y: event.clientY,
                },
            ]);

            window.setTimeout(() => {
                setRipples((prevRipples) => prevRipples.filter((ripple) => ripple.id !== rippleId));
            }, 320);
        };

        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        window.addEventListener("pointerdown", handlePointerDown, { passive: true });
        window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
        document.addEventListener("mouseleave", handlePointerLeave, { passive: true });

        return () => {
            mounted = false;
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("pointerleave", handlePointerLeave);
            document.removeEventListener("mouseleave", handlePointerLeave);
        };
    }, []);

    return (
        <div className="demo-cursor-layer" aria-hidden="true" data-testid="demo-cursor-layer">
            <div
                className={`demo-cursor${cursorState.visible ? " is-visible" : ""}`}
                style={{
                    transform: `translate3d(${cursorState.x}px, ${cursorState.y}px, 0)`,
                }}
                data-testid="demo-cursor"
            >
                <span className="demo-cursor-core" />
                <span className="demo-cursor-ring" />
            </div>

            {
                ripples.map((ripple) => (
                    <span
                        key={ripple.id}
                        className="demo-cursor-ripple"
                        style={{
                            transform: `translate3d(${ripple.x}px, ${ripple.y}px, 0)`,
                        }}
                    />
                ))
            }
        </div>
    );
}

export default DemoCursor;
