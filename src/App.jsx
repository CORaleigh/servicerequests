import { useState, useEffect } from 'react';
import {
    fetchToken, fetchProblems, fetchQA,
    createServiceRequest, searchRequests,
    fetchRequestsByIds, fetchRequestById,
} from './api/cityworks';
import { fetchFacilities, fetchFacilityData, fetchDistrict } from './api/gis';
import Header from './components/Header';
import Footer from './components/Footer';
import EmergencyAlert from './components/EmergencyAlert';
import FacilitySelect from './components/FacilitySelect';
import ProblemSelect from './components/ProblemSelect';
import QASection from './components/QASection';
import ContactForm from './components/ContactForm';
import RecentRequests from './components/RecentRequests';
import InfoModal from './components/InfoModal';
import RequestDetails from './components/RequestDetails';

const PROBLEM_SIDS = [26071, 26072, 26073, 24068, 19, 26074, 22, 23, 24, 25, 26, 31, 32, 28075, 6, 183894, 142744, 258161, 258162, 263680, 263677, 26069, 2062, 2063];

const EMPTY_CONTACT = { firstName: '', lastName: '', email: '', phone: '', comments: '' };

export default function App() {
    // Core
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // Data lists
    const [facilities, setFacilities] = useState([]);
    const [problems, setProblems] = useState([]);
    const [recentRequests, setRecentRequests] = useState([]);

    // Selections
    const [selectedFacility, setSelectedFacility] = useState('');
    const [facilityPoint, setFacilityPoint] = useState(null);
    const [facilityAddress, setFacilityAddress] = useState('');
    const [facilityExtent, setFacilityExtent] = useState(null);
    const [selectedProblem, setSelectedProblem] = useState('');

    // Q&A
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState([]);
    const [visibleIds, setVisibleIds] = useState([]);
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [freeValues, setFreeValues] = useState({});
    const [submitToFieldName, setSubmitToFieldName] = useState('');

    // Form
    const [contact, setContact] = useState(EMPTY_CONTACT);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [showAlert, setShowAlert] = useState(true);

    // Modal
    const [modal, setModal] = useState({ show: false, title: '', body: '' });

    // ── Init ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        async function init() {
            try {
                const tok = await fetchToken();
                setToken(tok);
                const [probs, facs] = await Promise.all([
                    fetchProblems(tok),
                    fetchFacilities(),
                ]);
                setProblems(
                    probs
                        .filter(p => PROBLEM_SIDS.includes(p.ProblemSid) && p.Description)
                        .sort((a, b) => a.Description.localeCompare(b.Description))
                );
                setFacilities(facs.map(f => f.attributes.LOCATION));
            } catch {
                openModal('Error', 'Could not connect to the Cityworks service. Please try again later.');
            } finally {
                setLoading(false);
            }
        }
        init();
    }, []);

    // Check ?id= param after token is ready
    useEffect(() => {
        if (!token) return;
        const id = new URLSearchParams(window.location.search).get('id');
        if (id) lookupRequest(id);
    }, [token]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    function openModal(title, body) {
        setModal({ show: true, title, body });
    }

    function clearAnswers() {
        setVisibleIds([]); setSelectedAnswers({}); setFreeValues({});
        setSubmitToFieldName('');
    }

    function clearProblem() {
        setSelectedProblem('');
        setQuestions([]); setAnswers([]);
        setRecentRequests([]);
        clearAnswers();
    }

    function resetForm() {
        clearProblem();
        setSelectedFacility('');
        setFacilityPoint(null); setFacilityAddress(''); setFacilityExtent(null);
        setContact(EMPTY_CONTACT); setErrors({});
        setShowAlert(true);
    }

    async function loadRecentRequests(extent, sid) {
        if (!extent) return;
        const params = { Extent: extent, Status: ['OPEN'], Closed: false, Cancelled: false };
        if (sid > 0) params.ProblemSid = [Number(sid)];
        try {
            const ids = await searchRequests(params, token);
            if (!ids?.length) { setRecentRequests([]); return; }
            const reqs = await fetchRequestsByIds(ids, token);
            setRecentRequests(reqs.sort((a, b) => b.RequestId - a.RequestId).slice(0, 5));
        } catch {
            // Non-critical panel — leave it empty rather than blocking the form.
            setRecentRequests([]);
        }
    }

    // ── Event handlers ───────────────────────────────────────────────────────
    async function handleFacilityChange(facility) {
        setSelectedFacility(facility);
        clearProblem();

        if (!facility) return;

        let features;
        try {
            features = await fetchFacilityData(facility);
        } catch {
            openModal('Error', 'Could not look up that facility. Please try again.');
            return;
        }
        if (!features.length) return;

        const pt = features[0].geometry;
        setFacilityPoint(pt);
        setFacilityAddress(features[0].attributes.LEGACYID);

        let ext;
        if (features.length > 1) {
            const xs = features.map(f => f.geometry.x);
            const ys = features.map(f => f.geometry.y);
            ext = { XMax: Math.max(...xs), XMin: Math.min(...xs), YMax: Math.max(...ys), YMin: Math.min(...ys) };
        } else {
            ext = { XMax: pt.x + 5, XMin: pt.x - 5, YMax: pt.y + 5, YMin: pt.y - 5 };
        }
        setFacilityExtent(ext);
        loadRecentRequests(ext, 0);
    }

    async function handleProblemChange(sid) {
        setSelectedProblem(sid);
        clearAnswers();
        setShowAlert(false);
        if (!sid) return;

        loadRecentRequests(facilityExtent, sid);

        try {
            const qa = await fetchQA(Number(sid), token);
            setAnswers(qa?.Answers ?? []);
            setQuestions(qa?.Questions ?? []);
            setVisibleIds(qa?.Questions?.length ? [qa.Questions[0].QuestionId] : []);
        } catch {
            openModal('Error', 'Could not load the questions for that problem. Please try again.');
        }
    }

    function handleAnswerSelect(qid, answer) {
        setSelectedAnswers(prev => ({ ...prev, [qid]: answer }));
        if (answer.SubmitToFieldName) setSubmitToFieldName(answer.SubmitToFieldName);

        setVisibleIds(prev => {
            const idx = prev.indexOf(qid);
            const chain = prev.slice(0, idx + 1);
            if (answer.NextQuestionId && questions.find(q => q.QuestionId === answer.NextQuestionId)) {
                chain.push(answer.NextQuestionId);
            }
            return chain;
        });
    }

    function handleFreeChange(qid, value) {
        setFreeValues(prev => ({ ...prev, [qid]: value }));
        if (!value) return;

        const ans = answers.find(a => a.QuestionId === qid);
        if (!ans) return;
        if (ans.SubmitToFieldName) setSubmitToFieldName(ans.SubmitToFieldName);
        if (ans.NextQuestionId) {
            setVisibleIds(prev => {
                const idx = prev.indexOf(qid);
                const chain = prev.slice(0, idx + 1);
                if (!chain.includes(ans.NextQuestionId) &&
                    questions.find(q => q.QuestionId === ans.NextQuestionId)) {
                    chain.push(ans.NextQuestionId);
                }
                return chain;
            });
        }
    }

    function validate() {
        const e = {};
        if (!contact.firstName.trim()) e.firstName = 'First name is required';
        if (!contact.lastName.trim()) e.lastName = 'Last name is required';
        if (!contact.email.trim()) e.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) e.email = 'Invalid email address';
        if (!contact.phone.trim()) e.phone = 'Phone number is required';
        else if (!/^(1-?)?(\([2-9]\d{2}\)|[2-9]\d{2})-?[2-9]\d{2}-?\d{4}$/.test(contact.phone.replace(/\s/g, ''))) {
            e.phone = 'Please enter a valid US phone number';
        }
        for (const qid of visibleIds) {
            const qAnswers = answers.filter(a => a.QuestionId === qid);
            const fmt = qAnswers[0]?.AnswerFormat;
            if ((fmt === 'YES' || fmt === 'NO' || fmt === 'THISTEXT') && !selectedAnswers[qid]) {
                e[`qa_${qid}`] = 'Selection required';
            } else if (fmt === 'FREETEXT' && !freeValues[qid]) {
                e[`qa_${qid}`] = 'Answer is required';
            }
        }
        setErrors(e);
        return !Object.keys(e).length;
    }

    function collectAnswers() {
        return visibleIds.flatMap(qid => {
            const qAnswers = answers.filter(a => a.QuestionId === qid);
            const fmt = qAnswers[0]?.AnswerFormat;
            if (!fmt) return [];
            if (fmt === 'YES' || fmt === 'NO' || fmt === 'THISTEXT') {
                const ans = selectedAnswers[qid];
                return ans ? [{ AnswerId: ans.AnswerId, AnswerValue: ans.Answer }] : [];
            }
            const val = freeValues[qid] ?? '';
            return [{ AnswerId: qAnswers[0].AnswerId, AnswerValue: val }];
        });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!validate()) return;
        if (!facilityPoint) {
            openModal('Error', 'This facility has no location on file, so the request cannot be '
                + 'submitted. Please call 919-996-3420.');
            return;
        }

        setSubmitting(true);
        try {
            let submitTo = '';
            if (submitToFieldName) {
                const field = `${submitToFieldName}_ID`;
                const districts = await fetchDistrict(facilityPoint.x, facilityPoint.y, field);
                if (districts.length) submitTo = districts[0].attributes[field];
            }

            const payload = {
                CallerFirstName: contact.firstName,
                CallerLastName: contact.lastName,
                CallerWorkPhone: contact.phone,
                CallerEmail: contact.email,
                Address: facilityAddress,
                ProblemSid: Number(selectedProblem),
                X: facilityPoint.x,
                Y: facilityPoint.y,
                Answers: collectAnswers(),
                Details: contact.comments,
                ...(submitTo && { SubmitTo: submitTo }),
            };

            const result = await createServiceRequest(payload, token);
            if (result.Status !== 0 || !result.Value?.RequestId) {
                throw new Error(result.Message || 'Cityworks rejected the request');
            }

            openModal('Service Request Submitted', (
                <p className="mb-0">
                    Your service request has been submitted. Use ID{' '}
                    <strong>{result.Value.RequestId}</strong> to track this request.
                </p>
            ));
            resetForm();
        } catch {
            openModal('Error', 'An error occurred while submitting your request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    async function lookupRequest(id) {
        if (!token || !id) return;
        try {
            const req = await fetchRequestById(id, token);
            if (!req) { openModal(`Request #${id}`, 'No request found.'); return; }
            openModal(
                `Service Request #${req.RequestId} Status`,
                <RequestDetails request={req} />
            );
        } catch {
            openModal('Error', 'Could not retrieve the request.');
        }
    }

    async function handleRequestClick(id) {
        try {
            const req = await fetchRequestById(id, token);
            if (req) openModal(`Problem Details — Request #${req.RequestId}`,
                req.Details || 'No details available.');
        } catch {
            openModal('Error', 'Could not retrieve the request details.');
        }
    }

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <>
            <Header onLookup={lookupRequest} ready={!!token} />
            <InfoModal
                show={modal.show}
                title={modal.title}
                body={modal.body}
                onClose={() => setModal(m => ({ ...m, show: false }))}
            />
            <div className="container mt-4">
                <div className="row">
                    <div className="col-lg-6">
                        <form onSubmit={handleSubmit} noValidate>
                            <FacilitySelect
                                facilities={facilities}
                                selected={selectedFacility}
                                loading={loading}
                                onChange={handleFacilityChange}
                            />
                            {selectedFacility && (
                                <ProblemSelect
                                    problems={problems}
                                    selected={selectedProblem}
                                    onChange={handleProblemChange}
                                />
                            )}
                            {selectedProblem && (
                                <>
                                    <QASection
                                        questions={questions}
                                        answers={answers}
                                        visibleIds={visibleIds}
                                        selectedAnswers={selectedAnswers}
                                        freeValues={freeValues}
                                        errors={errors}
                                        onAnswerSelect={handleAnswerSelect}
                                        onFreeChange={handleFreeChange}
                                    />
                                    <ContactForm
                                        values={contact}
                                        errors={errors}
                                        onChange={(field, val) => setContact(prev => ({ ...prev, [field]: val }))}
                                    />
                                    <button
                                        type="submit"
                                        className="btn btn-primary mb-4"
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Submitting…' : 'Submit'}
                                    </button>
                                </>
                            )}
                        </form>
                        {showAlert && <EmergencyAlert onClose={() => setShowAlert(false)} />}
                    </div>
                    <div className="col-lg-6">
                        {selectedFacility && (
                            <RecentRequests
                                requests={recentRequests}
                                onRowClick={handleRequestClick}
                            />
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
}
