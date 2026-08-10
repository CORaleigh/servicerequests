import { useEffect, useRef } from 'react';
import { Modal } from 'bootstrap';

/**
 * Bootstrap modal wrapper. `body` is a React node — never an HTML string, so
 * Cityworks-supplied text can't inject markup.
 */
export default function InfoModal({ show, title, body, onClose }) {
    const elRef = useRef(null);
    const modalRef = useRef(null);
    const onCloseRef = useRef(onClose);

    // Keep the latest onClose reachable from the listener registered below,
    // which is only attached once.
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    useEffect(() => {
        const el = elRef.current;
        const handleHidden = () => onCloseRef.current?.();
        modalRef.current = new Modal(el, { backdrop: 'static' });
        el.addEventListener('hidden.bs.modal', handleHidden);
        return () => {
            el.removeEventListener('hidden.bs.modal', handleHidden);
            modalRef.current?.dispose();
        };
    }, []);

    useEffect(() => {
        if (!modalRef.current) return;
        if (show) modalRef.current.show();
        else modalRef.current.hide();
    }, [show]);

    return (
        <div className="modal fade" ref={elRef} tabIndex="-1" aria-labelledby="modalTitle">
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title" id="modalTitle">{title}</h5>
                        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    <div className="modal-body">{body}</div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
