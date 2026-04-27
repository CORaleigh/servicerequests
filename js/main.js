const config = {
    cwApiUrl: 'https://cityworks.raleighnc.gov/admin/Services/AMS/',
    tokenUrl: 'php/token.php',
    problemSids: [26071, 26072, 26073, 24068, 19, 26074, 22, 23, 24, 25, 26, 31, 32, 28075, 6, 183894, 142744, 258161, 258162, 263680, 263677, 26069, 2062, 2063],
    buildings: 'https://cityworksgisprd.raleighnc.gov/arcgis/rest/services/cityworks/FACILITIES/MapServer/1/query',
    districts: 'https://cityworksgisprd.raleighnc.gov/arcgis/rest/services/cityworks/PARKS/MapServer/28/query',
    mail: {
        script: 'https://maps.raleighnc.gov/php/mail.php',
        from: 'Cityworks Support',
        fromEmail: 'cityworks@raleighnc.gov'
    }
};

let token, questions, answers, address, point, facExtent;
let submitToFieldName = '';

function cwPost(url, payload, callback) {
    $.ajax({
        url,
        method: 'POST',
        headers: { Authorization: `cityworks ${token}` },
        data: { data: JSON.stringify(payload) },
        success: callback
    });
}

function showModal(title, bodyContent) {
    document.getElementById('modalTitle').textContent = title;
    const body = document.querySelector('#infoModal .modal-body');
    if (typeof bodyContent === 'string') {
        body.innerHTML = bodyContent;
    } else {
        body.innerHTML = '';
        body.appendChild(bodyContent);
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById('infoModal')).show();
}

function clearForm() {
    $('.hidden1').hide();
    $('.hidden2').hide();
    $('#firstName').val('');
    $('#lastName').val('');
    $('#inputEmail').val('');
    $('#inputPhone').val('');
    $('#inputComments').val('');
    $('#qaDiv').empty();
    $('#facilitySelect').prepend("<option value='prompt' selected>Select a facility...</option>");
    $('#problemSelect').prepend("<option value='prompt' selected>Select a problem...</option>");
    $('form button[type=submit]').removeClass('disabled');
    $('.alert').show();
}

function sendEmail(id) {
    $.ajax({
        crossDomain: true,
        url: config.mail.script,
        type: 'POST',
        dataType: 'jsonp',
        data: {
            from: config.mail.from,
            fromEmail: config.mail.fromEmail,
            to: `${$('#firstName').val()} ${$('#lastName').val()}`,
            toEmail: $('#inputEmail').val(),
            message: `Your service request has been submitted, use ID ${id} to reference this service request. The status can be tracked here: https://cityworks.raleighnc.gov/servicerequests/?id=${id}`,
            subject: `Cityworks Service Request ${id}`
        }
    });
}

function submitToCityworks(submitTo) {
    const submitAnswers = [];
    $('.answer').each(function(i, answer) {
        if ($(answer).hasClass('btn-group')) {
            submitAnswers.push({ AnswerId: $('.active', answer).data('aid'), AnswerValue: $('.active', answer).text() });
        } else if (answer.localName === 'select') {
            submitAnswers.push({ AnswerId: $('option:selected', answer).data('aid'), AnswerValue: $('option:selected', answer).val() });
        } else if (answer.localName === 'textarea') {
            submitAnswers.push({ AnswerId: $(answer).data('aid'), AnswerValue: $(answer).val() });
        } else if (answer.localName === 'input') {
            submitAnswers.push({ AnswerId: $(answer).data('aid'), AnswerValue: $(answer).val() });
        }
    });

    const submit = {
        CallerFirstName: $('#firstName').val(),
        CallerLastName: $('#lastName').val(),
        CallerWorkPhone: $('#inputPhone').val(),
        CallerEmail: $('#inputEmail').val(),
        Address: address,
        ProblemSid: $('option:selected', '#problemSelect').val(),
        X: point.x,
        Y: point.y,
        Answers: submitAnswers,
        Details: $('#inputComments').val()
    };
    if (submitTo !== '') {
        submit.SubmitTo = submitTo;
    }

    $('form button[type=submit]').addClass('disabled');
    cwPost(config.cwApiUrl + 'ServiceRequest/Create', submit, function(data) {
        if (data.Status === 0) {
            const id = data.Value.RequestId;
            sendEmail(id);
            clearForm();
            showModal('Service Request Submitted', `Your service request has been submitted. Use ID <strong>${id}</strong> to reference this request.`);
        }
    });
}

async function getSubmitToName() {
    const fieldName = `${submitToFieldName}_ID`;
    const params = new URLSearchParams({
        f: 'json',
        geometryType: 'esriGeometryPoint',
        geometry: `${point.x},${point.y}`,
        returnGeometry: false,
        outFields: fieldName
    });
    const resp = await fetch(`${config.districts}?${params}`);
    const data = await resp.json();
    if (data.features && data.features.length > 0) {
        submitToCityworks(data.features[0].attributes[fieldName]);
    } else {
        submitToCityworks('');
    }
}

function submitRequest() {
    if (submitToFieldName !== '') {
        getSubmitToName();
    } else {
        submitToCityworks('');
    }
}

function addNextQuestion(next) {
    const question = questions.find(q => q.QuestionId === next);
    if (question) {
        addQuestion(question);
    }
}

function getQid(answer) {
    return answer.length > 0 ? answer.data('qid') : 0;
}

function addYesNoAnswer(form, qAnswers, seq) {
    const buttons = $('<div class="btn-group" data-bs-toggle="buttons" name="answerYesNo"></div>').appendTo(form);
    form.append('<span class="form-text text-danger">Selection required</span>');
    form.addClass('has-error');

    qAnswers.forEach(a => {
        buttons.append(`<label class="btn btn-danger answer" data-submit="${a.SubmitToFieldName}" data-seq="${seq}" data-next="${a.NextQuestionId}" data-aid="${a.AnswerId}" data-qid="${a.QuestionId}"><input type="radio" name="yesno">${a.Answer}</label>`);
    });

    $('label', buttons).on('click', function() {
        const next = $(this).data('next');
        const frm = $(this).closest('.form-group');
        const idx = frm.index() + 1;
        const nextForm = frm.next();

        if (nextForm.length > 0) {
            const qid = getQid(nextForm.find('.answer'));
            if (next !== qid) {
                $('#qaDiv').children().slice(idx).remove();
                addNextQuestion(next);
            }
        } else {
            addNextQuestion(next);
        }

        if ($(this).data('submit') !== '') {
            submitToFieldName = $(this).data('submit');
        }

        $('.form-text', $(this).parent().parent()).hide();
        $('label', $(this).parent()).removeClass('btn-danger').addClass('btn-primary');
        $(this).parent().parent().removeClass('has-error');
    });
}

function addThisTextAnswer(form, qAnswers, seq, qid) {
    const select = $(`<select class="form-select answer" data-seq="${seq}" name="answerSelect${seq}" data-qid="${qid}"><option value="prompt">Select answer...</option></select>`).appendTo(form);
    form.append('<span class="form-text text-danger"></span>');

    select.change(function() {
        const next = $('option:selected', this).data('next');
        const frm = $(this).closest('.form-group');
        const idx = frm.index() + 1;
        const nextForm = frm.next();

        if ($('option:selected', this).data('submit') !== '') {
            submitToFieldName = $('option:selected', this).data('submit');
        }
        if ($($('option', this)[0]).val() === 'prompt') {
            $($('option', this)[0]).remove();
        }
        if (nextForm.length > 0) {
            const q = getQid(nextForm.find('.answer'));
            if (next !== q) {
                $('#qaDiv').children().slice(idx).remove();
                addNextQuestion(next);
            }
        } else {
            addNextQuestion(next);
        }
    });

    qAnswers.forEach(a => {
        select.append(`<option data-submit="${a.SubmitToFieldName}" data-next="${a.NextQuestionId}" value="${a.Answer}" data-aid="${a.AnswerId}" data-qid="${a.QuestionId}">${a.Answer}</option>`);
    });

    select.rules('add', { valueNotEquals: 'prompt' });
}

function addFreeTextAnswer(form, qAnswers, seq) {
    $(`<textarea class="form-control answer" data-submit="${qAnswers[0].SubmitToFieldName}" data-seq="${seq}" name="answerArea${seq}" data-next="${qAnswers[0].NextQuestionId}" data-aid="${qAnswers[0].AnswerId}" data-qid="${qAnswers[0].QuestionId}"></textarea><span class="form-text text-danger"></span>`)
        .appendTo(form)
        .first()
        .on('keyup', function() {
            if ($(this).val().length > 0) {
                const next = $(this).data('next');
                const frm = $(this).closest('.form-group');
                const idx = frm.index() + 1;
                const nextForm = frm.next();

                if ($(this).data('submit') !== '') {
                    submitToFieldName = $(this).data('submit');
                }
                if (nextForm.length > 0) {
                    const q = getQid(nextForm.find('.answer'));
                    if (next !== q) {
                        $('#qaDiv').children().slice(idx).remove();
                        addNextQuestion(next);
                    }
                } else {
                    addNextQuestion(next);
                }
            }
        })
        .rules('add', { required: true });
}

function addDateAnswer(form, qAnswers, seq) {
    const input = $(`<input type="datetime-local" class="form-control answer" data-submit="${qAnswers[0].SubmitToFieldName}" data-seq="${seq}" data-next="${qAnswers[0].NextQuestionId}" data-aid="${qAnswers[0].AnswerId}" data-qid="${qAnswers[0].QuestionId}">`);
    form.append(input);

    input.on('change', function() {
        const next = $(this).data('next');
        const nextForm = $(this).closest('.form-group').parent().next();
        if ($(this).data('submit') !== '') {
            submitToFieldName = $(this).data('submit');
        }
        if (nextForm.length === 0) {
            addNextQuestion(next);
        }
    });
}

function addQuestion(question) {
    const qid = question.QuestionId;
    const form = $("<div class='form-group mb-3'></div>").appendTo('#qaDiv');
    const qAnswers = answers.filter(a => a.QuestionId === qid);

    form.append(`<p><span>${question.Question}</span></p>`);

    const format = qAnswers.length > 0 ? qAnswers[0].AnswerFormat : '';
    if (format === 'YES' || format === 'NO') {
        addYesNoAnswer(form, qAnswers, question.QuestionSequence);
    } else if (format === 'FREETEXT') {
        addFreeTextAnswer(form, qAnswers, question.QuestionSequence);
    } else if (format === 'THISTEXT') {
        addThisTextAnswer(form, qAnswers, question.QuestionSequence, qid);
    } else if (format === 'DATE') {
        addDateAnswer(form, qAnswers, question.QuestionSequence);
    }
}

function problemSelected() {
    $('.hidden2').show();
    $('.alert').hide();
    const sid = $('option:selected', this).val();
    getOpenRequests(facExtent, sid);
    cwPost(config.cwApiUrl + 'ServiceRequest/QA', { ProblemSid: sid }, function(data) {
        submitToFieldName = '';
        answers = data.Value.Answers;
        questions = data.Value.Questions;
        $('#qaDiv').empty();
        if (questions.length > 0) {
            addQuestion(questions[0]);
        } else {
            showModal('No Questions', 'No questions available for the selected problem.');
        }
    });
}

function getProblems() {
    cwPost(config.cwApiUrl + 'ServiceRequest/Problems', { ForPublicOnly: false }, function(data) {
        data.Value.sort((a, b) => a.Description > b.Description ? 1 : -1);
        data.Value.forEach(problem => {
            if (config.problemSids.includes(problem.ProblemSid) && problem.Description.length > 0) {
                $('#problemSelect').append(`<option value="${problem.ProblemSid}">${problem.Description}</option>`);
            }
        });
        $('#problemSelect').change(problemSelected);
    });
}

function getToken() {
    $.post(config.tokenUrl, function(data) {
        token = data.Value.Token;
        getProblems();
        init();
    });
}

function getRequestDetails(id) {
    cwPost(config.cwApiUrl + 'ServiceRequest/ById', { RequestId: id }, function(data) {
        const details = (data.Value && data.Value.Details) ? data.Value.Details : 'No details available';
        showModal(`Problem Details — Request #${data.Value.RequestId}`, `<span>${details}</span>`);
    });
}

function getRequestsByIds(ids) {
    cwPost(config.cwApiUrl + 'ServiceRequest/ByIds', { RequestIds: ids }, function(data) {
        const tbody = $('tbody', '#table').empty();
        if (data.Value) {
            data.Value
                .sort((a, b) => b.RequestId - a.RequestId)
                .slice(0, 5)
                .forEach(req => {
                    tbody.append(`<tr><td>${req.RequestId}</td><td>${req.Description}</td><td>${req.DateTimeInit.replace('T', ' at ')}</td></tr>`);
                });
        }
        $('tr', tbody).click(function() {
            getRequestDetails($('td', this).first().text());
        });
    });
}

function getOpenRequests(extent, sid) {
    const params = { Extent: extent, Status: ['OPEN'], Closed: false, Cancelled: false };
    if (sid > 0) {
        params.ProblemSid = [sid];
    }
    cwPost(config.cwApiUrl + 'ServiceRequest/Search', params, function(data) {
        getRequestsByIds(data.Value);
    });
}

async function facilitySelected(facility) {
    $('.hidden1').show();

    const params = new URLSearchParams({
        f: 'json',
        where: `LOCATION = '${facility.replace(/'/g, "''")}'`,
        outFields: '*',
        returnGeometry: true
    });

    const resp = await fetch(`${config.buildings}?${params}`);
    const data = await resp.json();

    if (data.features && data.features.length > 0) {
        point = data.features[0].geometry;
        address = data.features[0].attributes.LEGACYID;

        let ext;
        if (data.features.length > 1) {
            const xs = data.features.map(f => f.geometry.x);
            const ys = data.features.map(f => f.geometry.y);
            ext = { XMax: Math.max(...xs), XMin: Math.min(...xs), YMax: Math.max(...ys), YMin: Math.min(...ys) };
        } else {
            ext = { XMax: point.x + 5, XMin: point.x - 5, YMax: point.y + 5, YMin: point.y - 5 };
        }

        facExtent = ext;
        const sid = $('option:selected', '#problemSelect').val();
        getOpenRequests(ext, sid !== 'prompt' ? sid : 0);
    }
}

async function buildFacilityList() {
    const select = $('#facilitySelect');
    const params = new URLSearchParams({
        f: 'json',
        where: "WEBFORM = 'Y'",
        returnGeometry: false,
        outFields: 'LOCATION,LEGACYID',
        returnDistinctValues: true,
        orderByFields: 'LOCATION'
    });

    const resp = await fetch(`${config.buildings}?${params}`);
    const data = await resp.json();

    if (data.features && data.features.length > 0) {
        data.features.forEach(f => {
            select.append(`<option>${f.attributes.LOCATION}</option>`);
        });
    }
    select.prop('disabled', false);
    select.change(function() {
        facilitySelected($('option:selected', select).val());
    });
}

function placeErrors(error, element) {
    const $group = $(element).closest('.row.mb-3, .form-group');
    $group.addClass('has-error');
    $group.find('.field-error').show().text($(error[0]).text());
}

function removeErrors(label, element) {
    const $group = $(element).closest('.row.mb-3, .form-group');
    $group.removeClass('has-error');
    $group.find('.field-error').hide().text('');
}

function validateYesNo() {
    return !$('input[name=yesno]').parent().parent().parent().hasClass('has-error');
}

function setupValidation() {
    $.validator.addMethod('phoneUS', function(phone_number, element) {
        phone_number = phone_number.replace(/\s+/g, '');
        return this.optional(element) || (phone_number.length > 9 &&
            /^(1-?)?(\([2-9]\d{2}\)|[2-9]\d{2})-?[2-9]\d{2}-?\d{4}$/.test(phone_number));
    }, 'Please specify a valid phone number');

    $.validator.addMethod('valueNotEquals', function(value, element, arg) {
        return arg !== value;
    }, 'Selection required');

    $('#srForm').validate({
        ignore: [],
        rules: {
            first: { required: true },
            last: { required: true },
            email: { required: true, email: true },
            phonenum: { required: true, phoneUS: true }
        },
        submitHandler() {
            if (validateYesNo()) {
                submitRequest();
            } else {
                showModal('Validation Error', 'A required field was not entered.');
            }
        },
        errorPlacement: placeErrors,
        success: removeErrors
    });
}

function addStatusInfo(form, label, value) {
    form.append(`<div class="row mb-2">
        <label class="col-lg-4 col-form-label fw-semibold">${label}</label>
        <div class="col-lg-8"><p class="form-control-plaintext">${value}</p></div>
    </div>`);
}

function getServiceRequest(id) {
    cwPost(config.cwApiUrl + 'ServiceRequest/ById', { RequestId: id }, function(data) {
        if (data.Value) {
            const form = $('<form class="container-fluid" role="form">');
            addStatusInfo(form, 'Status', data.Value.Status);
            addStatusInfo(form, 'Submitted On', data.Value.DateTimeInit);
            if (data.Value.Comments) {
                addStatusInfo(form, 'Comments', data.Value.Comments);
            }
            if (data.Value.isClosed) {
                addStatusInfo(form, 'Closed On', data.Value.DateTimeClosed);
                addStatusInfo(form, 'Closed By', data.Value.ClosedBy);
            }
            if (data.Value.Cancel) {
                addStatusInfo(form, 'Cancelled On', data.Value.DateTimeCancelled);
                addStatusInfo(form, 'Cancelled By', data.Value.CancelledBy);
                addStatusInfo(form, 'Reason', data.Value.CancelReason);
            }
            showModal(`Service Request #${data.Value.RequestId} Status`, form[0]);
        } else {
            showModal(`Service Request #${id} Status`, 'No request found.');
        }
    });
}

function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('id')) {
        getServiceRequest(params.get('id'));
    }
}

$(document).ready(function() {
    getToken();
});

function init() {
    $('select').change(function() {
        if ($($('option', this)[0]).val() === 'prompt') {
            $($('option', this)[0]).remove();
        }
    });
    buildFacilityList();
    setupValidation();
    $('#statusBtn').click(function() {
        getServiceRequest($('#statusInput').val());
    });
    checkUrlParams();
}
