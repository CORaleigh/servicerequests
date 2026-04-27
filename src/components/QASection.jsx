function YesNoAnswer({ qAnswers, selected, error, onSelect }) {
    return (
        <div className={error ? 'has-error' : ''}>
            <div className="btn-group" role="group">
                {qAnswers.map(a => (
                    <button
                        key={a.AnswerId}
                        type="button"
                        className={`btn ${selected?.AnswerId === a.AnswerId ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => onSelect(a)}
                    >
                        {a.Answer}
                    </button>
                ))}
            </div>
            {error && <div className="form-text text-danger">{error}</div>}
        </div>
    );
}

function ThisTextAnswer({ qAnswers, selected, error, onSelect }) {
    return (
        <div className={error ? 'has-error' : ''}>
            <select
                className="form-select"
                value={selected?.Answer ?? ''}
                onChange={e => {
                    const ans = qAnswers.find(a => a.Answer === e.target.value);
                    if (ans) onSelect(ans);
                }}
            >
                <option value="">Select answer…</option>
                {qAnswers.map(a => (
                    <option key={a.AnswerId} value={a.Answer}>{a.Answer}</option>
                ))}
            </select>
            {error && <div className="form-text text-danger">{error}</div>}
        </div>
    );
}

function FreeTextAnswer({ value, error, onChange }) {
    return (
        <div className={error ? 'has-error' : ''}>
            <textarea
                className="form-control"
                value={value}
                onChange={e => onChange(e.target.value)}
                rows={3}
            />
            {error && <div className="form-text text-danger">{error}</div>}
        </div>
    );
}

function DateAnswer({ value, onChange }) {
    return (
        <input
            type="datetime-local"
            className="form-control"
            value={value}
            onChange={e => onChange(e.target.value)}
        />
    );
}

function Question({ question, allAnswers, selected, freeValue, error, onSelect, onFreeChange }) {
    const qAnswers = allAnswers.filter(a => a.QuestionId === question.QuestionId);
    const format = qAnswers[0]?.AnswerFormat ?? '';

    return (
        <div className="mb-3">
            <p className="fw-semibold mb-1">{question.Question}</p>
            {(format === 'YES' || format === 'NO') && (
                <YesNoAnswer qAnswers={qAnswers} selected={selected} error={error} onSelect={onSelect} />
            )}
            {format === 'THISTEXT' && (
                <ThisTextAnswer qAnswers={qAnswers} selected={selected} error={error} onSelect={onSelect} />
            )}
            {format === 'FREETEXT' && (
                <FreeTextAnswer value={freeValue ?? ''} error={error} onChange={onFreeChange} />
            )}
            {format === 'DATE' && (
                <DateAnswer value={freeValue ?? ''} onChange={onFreeChange} />
            )}
        </div>
    );
}

export default function QASection({
    questions,
    answers,
    visibleIds,
    selectedAnswers,
    freeValues,
    errors,
    onAnswerSelect,
    onFreeChange,
}) {
    if (!questions.length) return null;

    return (
        <div className="card shadow mb-4">
            <div className="card-body">
                <h4 className="card-title">Answer Questions</h4>
                {visibleIds.map(qid => {
                    const question = questions.find(q => q.QuestionId === qid);
                    if (!question) return null;
                    return (
                        <Question
                            key={qid}
                            question={question}
                            allAnswers={answers}
                            selected={selectedAnswers[qid]}
                            freeValue={freeValues[qid]}
                            error={errors[`qa_${qid}`]}
                            onSelect={ans => onAnswerSelect(qid, ans)}
                            onFreeChange={val => onFreeChange(qid, val)}
                        />
                    );
                })}
            </div>
        </div>
    );
}
