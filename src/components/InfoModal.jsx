import { useEffect, useRef } from 'react';
import { Modal } from 'bootstrap';

export default function InfoModal({ show, title, body, onClose }) {
    const ref = useRef(null);
    const modalRef = useRef(null);

    useEffect(() => {
        modalRef.current = new Modal(ref.current, { backdrop: 'static' });
        ref.current.addEventListener('hidden.bs.modal', onClose);
        return () => modalRef.current?.dispose();
    }, []);

    useEffect(() => {
        if (!modalRef.current) return;
        show ? modalRef.current.show() : modalRef.current.hide();
    }, [show]);

    return (
        <div className="modal fade" ref={ref} tabIndex="-1" aria-labelledby="modalTitle" aria-hidden="true">
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title" id="modalTitle">{title}</h5>
                        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    <div
                        className="modal-body"
                        dangerouslySetInnerHTML={typeof body === 'string' ? { __html: body } : undefined}
                    >
                        {typeof body !== 'string' ? body : undefined}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
