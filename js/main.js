var config = {
	"cwApiUrl" : "http://cityworkstest.ci.raleigh.nc.us/cityworkstest/Services/AMS/",
	"cwLogin" : {"LoginName" : "interfacew", "Password" : "Welcome1"},
	"problemSids": [293662,293664,293665,293666,293667,293668,293669,293670,293671,293672,2063,2062,31,32,142744,26071,289672,6,26074,29],
	"baseMap" : "https://maps.raleighnc.gov/arcgis/rest/services/BaseMapMobile/MapServer",
	"buildings" : "https://maps.raleighnc.gov/arcgis/rest/services/Cityworks/CITYW_BUILDINGS/MapServer/0/query",
	"districts" : "http://cityworkstest.ci.raleigh.nc.us/arcgis/rest/services/FACILITIES/MapServer/11/query",
	"mail":{
		"script":"http://maps.raleighnc.gov/php/mail.php",
		"from":"Cityworks Support",
		"fromEmail":"cityworks@raleighnc.gov"
	}
}
var map, token, questions, answers, point, facExtent;

function clearForm () {
	$(".hidden1").hide();
	$(".hidden2").hide();
	$("#firstName").val("");
	$("#lastName").val("");
	$("#inputEmail").val("");
	$("#inputPhone").val("");
	$("#inputComments").val("");
	$("#qaDiv").empty();
	$("#facilitySelect").prepend("<option value='prompt' selected>Select a facility...</option");
	$("#problemSelect").prepend("<option value='prompt' selected>Select a problem...</option");
	$("form button").removeClass("disabled");
	$(".alert").show();
	map.graphics.clear();
}

function sendEmail (id) {
	$.ajax({
		crossDomain: true,
		url: config.mail.script,
		type: 'POST',
		dataType: 'jsonp',
		data: {
			from: config.mail.from,
			fromEmail: config.mail.fromEmail,
			to: $("#firstName").val() + " " + $("#lastName").val(),
			toEmail: $("#inputEmail").val(),
			message:"Your service request has been submitted, use ID "+id+" to reference this service request. The status can be tracked here: "+
				"http://cityworkstest.ci.raleigh.nc.us/ServiceRequest/?id="+id,
			subject:"Cityworks Service Request "+id
		},
	})
	.done(function() {
		console.log("success");
	})
	.fail(function() {
		console.log("error");
	})
	.always(function() {
		console.log("complete");
	});

}

function submitToCityworks (submitTo) {
	var submitAnswers = [];
	$(".answer").each(function (i, answer) {
		if ($(answer).hasClass("btn-group")) {
			submitAnswers.push({AnswerId: $(".active", answer).data("aid"), AnswerValue:  $(".active", answer).text()});
		} else if (answer.localName === "select") {
			submitAnswers.push({AnswerId: $("option:selected", answer).data("aid"), AnswerValue:  $("option:selected", answer).val()});
		}
		else if (answer.localName === "textarea") {
			submitAnswers.push({AnswerId: $(answer).data("aid"), AnswerValue: $(answer).val()});
		} else if (answer.localName === "input") {
			var dateStr = $(answer).val(),
				year = dateStr.substr(6,4) + "-" + dateStr.substr(0,2) + "-" + dateStr.substr(3,2) + "T" + dateStr.substr(11,5) + ":00";
			submitAnswers.push({AnswerId: $(answer).data("aid"), AnswerValue: $(answer).val()});
		}
	});
	var submit = {
		CallerFirstName: $("#firstName").val(),
		CallerLastName: $("#lastName").val(),
		CallerWorkPhone: $("#inputEmail").val(),
		CallerEmail: $("#inputPhone").val(),
		ProblemSid: $("option:selected", "#problemSelect").val(),
		X: point.x,
		Y: point.y,
		Answers: submitAnswers,
		Details: $("#inputComments").val()
	};
	if (submitTo != "") {
		submit.SubmitTo = submitTo;
	}
	$("form button").addClass("disabled");
	$.post(config.cwApiUrl+"ServiceRequest/Create",
	    { data:  dojo.toJson(submit),token:token },
	    function (data) {
	    	if (data.Status === 0) {
	    		sendEmail(data.Value.RequestId);
	    		clearForm();
	    		alert("Service request successfully submitted, a confirmation email has been sent to the entered address.");
	    	}
	    }
	);
}

function getSubmitToName () {

		$.ajax({
			url: config.districts,
			dataType: 'jsonp',
			data: {
				f: 'json',
				geometryType: 'esriGeometryPoint',
				geometry: point.x + ',' + point.y,
				returnGeometry: false,
				outFields: submitToFieldName
			},
		})
		.done(function(data) {
			if (data.features.length > 0) {
				submitTo = data.features[0].attributes[submitToFieldName];
				submitToCityworks(submitTo);

			} else {
				submitToCityworks("");
			}
		});

}

function submitRequest () {
	if (submitToFieldName != "") {
		getSubmitToName();
	} else {
		submitToCityworks("");
	}

}

function addNextQuestion (next) {
	var question = $(questions).filter(function (i) {return questions[i].QuestionId === next});
	if (question.length > 0) {
		addQuestion(question[0]);
	}
}

function getQid(answer) {
	var qid = 0;
	if (answer.length > 0) {
		qid = answer.data("qid");
	}
	return qid;
}

function addYesNoAnswer(form, qAnswers, seq) {
	var buttons = $('<div class="btn-group" data-toggle="buttons" name="answerYesNo"></div>').appendTo(form);
	form.append('<span class="help-block">Selection required</span>');
	$("help-block", form).show();
	form.addClass("has-error");

	$(qAnswers).each(function (i, a) {
		buttons.append('<label class="btn btn-danger answer" data-submit="' + a.SubmitToFieldName + '" data-seq="' + seq + '" data-next="' + a.NextQuestionId + '" data-aid="' + a.AnswerId + '" data-qid="' +  a.QuestionId + '"><input type="radio" name="yesno">' + a.Answer + '</input></label>');
	});

	$("label", buttons).on("click", function () {
		var seq = $(this).data("seq") + 1,
			next = $(this).data("next"),
			form = $(this).closest(".form-group"),
			idx = form.index() + 1,
			nextForm = form.next();
			//idx = $(this).index() + 1;
		if (nextForm.length > 0) {
			var answer = nextForm.find(".answer"),
				qid = getQid(answer);
			if (next != qid) {
				$("#qaDiv").children().slice(idx).remove();
				addNextQuestion(next);
			}
		} else {
			addNextQuestion(next);
		}
		$(".help-block", $(this).parent().parent()).hide();
		$("label", $(this).parent()).removeClass("btn-danger");
		$("label", $(this).parent()).addClass("btn-primary");
		$(this).parent().parent().removeClass("has-error");

	});
}

var submitToFieldName = "";

function addThisTextAnswer (form, qAnswers, seq, qid) {
	var select = $('<select class="form-control answer" data-seq="' + seq + '" name="answerSelect' + seq + '" data-qid="' +  qid + '"><option value="prompt">Select answer...</option></select>').appendTo(form);
	form.append('<span class="help-block"></span>');
	select.change(function () {
		var seq = $(this).data("seq") + 1,
			next = $("option:selected", this).data("next"),
			form = $(this).closest(".form-group"),
			idx = form.index() + 1,
			nextForm = form.next();
		if ($("option:selected", this).data("submit") != "") {
			submitToFieldName = $("option:selected", this).data("submit");
		}

			//idx = $(this).index() + 1;

		if ($($("option", this)[0]).val() === "prompt") {
			$($("option", this)[0]).remove();
		}

		if (nextForm.length > 0) {
			var answer = nextForm.find(".answer");
				qid = getQid(answer);
			if (next != qid) {
				$("#qaDiv").children().slice(idx).remove();
				addNextQuestion(next);
			}

		} else {
			addNextQuestion(next);
		}


	});
	$(qAnswers).each(function (i, a) {
		select.append('<option data-submit="' + a.SubmitToFieldName + '" data-next="' + a.NextQuestionId + '" value="' + a.AnswerId + '" data-aid="' + a.AnswerId + '" data-qid="' +  a.QuestionId + '">' + a.Answer + '</option>');
	});

	select.rules("add", {valueNotEquals: "prompt"});
}

function addFreeTextAnswer (form, qAnswers, seq) {
	var area = $('<textarea class="form-control answer" data-submit="' + qAnswers[0].SubmitToFieldName + '" data-seq="' + seq + '" name="answerArea' + seq + '" data-next="' + qAnswers[0].NextQuestionId + '" data-aid="' + qAnswers[0].AnswerId + '" data-qid="' +  qAnswers[0].QuestionId + '"></textarea><span class="help-block"></span>').appendTo(form).on("keyup", function () {
		if ($(this).val().length > 0) {
			var seq = $(this).data("seq") + 1,
				next = $(this).data("next"),
				form = $(this).closest(".form-group"),
				idx = form.index() + 1,
				nextForm = form.next();

		if ($(this).data("submit") != "") {
			submitToFieldName = $(this).data("submit");
		}
		submitToFieldName = $(this).data("submit");
				//idx = $(this).index() + 1;
			if (nextForm.length > 0) {
				var answer = nextForm.find(".answer");
					qid = getQid(answer);
				if (next != qid) {
					$("#qaDiv").children().slice(idx).remove();
					addNextQuestion(next);
				}
			} else {
				addNextQuestion(next);
			}

		} else {

		};
	}).rules("add", { required: true });
}

function addDateAnswer (form, qAnswers, seq) {
	var datepicker = $('<div class="form-group">' +
                '<div class="input-group date" id="datetimepicker1">' +
                    '<input id="dateInput" type="text" class="form-control answer" data-submit="' + qAnswers[0].SubmitToFieldName + '" data-seq="' + seq + '" data-next="' + qAnswers[0].NextQuestionId  +'" data-aid="'+  qAnswers[0].AnswerId +'" data-qid="' +  qAnswers[0].QuestionId + '"/>' +
                    '<span class="input-group-addon"><span class="glyphicon glyphicon-calendar"></span>' +
                    '</span>' +
                '</div>' +
            '</div>').appendTo(form);
	datepicker.datetimepicker({pickSeconds: false, maskInput: true, pick12HourFormat: true});
	datepicker.on('changeDate', function (e) {
		var next = $("input", this).data("next"),
			form = $(this).closest(".form-group"),
			nextForm = form.parent().next();
		if ($("input", this).data("submit") != "") {
			submitToFieldName = $("input", this).data("submit");
		}

		if (nextForm.length === 0) {
			addNextQuestion(next);
		}
	});
}

function addQuestion (question) {
	var format = "",
		qid = question.QuestionId
		form = $("<div class='form-group'></div>").appendTo('#qaDiv');
	qAnswers = $(answers).filter(function (i) {
		return answers[i].QuestionId === qid;
	});

	form.append("<p><span>" + question.Question + "</span></p>")

	if (qAnswers.length > 0) {
		format = qAnswers[0].AnswerFormat;
	}

	if (format === "YES" || format === "NO") {
		addYesNoAnswer(form, qAnswers, question.QuestionSequence);
	} else if (format === "FREETEXT") {
		addFreeTextAnswer(form, qAnswers, question.QuestionSequence);
	} else if (format === "THISTEXT") {
		addThisTextAnswer(form, qAnswers, question.QuestionSequence, question.QuestionId);
	} else if (format === "DATE") {
		addDateAnswer(form, qAnswers, question.QuestionSequence);
	}
}

function problemSelected () {
	$(".hidden2").show();
	$(".alert").hide();
	var sid = $("option:selected", this).val();
	getOpenRequests(facExtent, sid);
	$.post(config.cwApiUrl+"ServiceRequest/QA",
	    { data:  dojo.toJson({ ProblemSid: sid}),token:token },
	    function (data) {
	    	submitToFieldName = "";
	    	answers = data.Value.Answers;
	    	questions = data.Value.Questions;
	    	$("#qaDiv").empty();
	    	if (questions.length > 0) {
	    		addQuestion(questions[0]);
	    	} else {
	    		alert("No questions available for selected problem");
	    	}

	    }
	);
}

function getProblems () {
	$.post(config.cwApiUrl+"ServiceRequest/Problems",
	    { data:  dojo.toJson({ ForPublicOnly: false}),token:token },
	    function (data) {
	    	data.Value.sort(function (a, b) {
	    		return (a.Description > b.Description) ? 1 : -1;
	    	});
	    	$(data.Value).each(function (i, problem) {
	    		if ($.inArray(problem.ProblemSid, config.problemSids) > -1) {
	    			if (problem.Description.length > 0) {
	    				$("#problemSelect").append("<option value='"+problem.ProblemSid+"'>"+problem.Description+"</option>");
	    			}
	    		}
	    	});
	    	$("#problemSelect").change(problemSelected);
	    }
	);
}

function getToken () {
	$.post(config.cwApiUrl+"Authentication/Authenticate", {data: dojo.toJson(config.cwLogin)}, function (data, textStatus, xhr) {
		token = data.Value.Token;
		getProblems();
		init();
	}).fail(function (data, textStatus, xhr) {

	});
}

function addPointToMap (x, y) {
	require(["esri/geometry/Point", "esri/graphic", "esri/symbols/PictureMarkerSymbol"], function (Point, Graphic, PictureMarkerSymbol) {
		var point = new Point(x, y, map.spatialReference),
			g = new Graphic(point, new PictureMarkerSymbol("img/pin.png", 50, 50));
		map.centerAndZoom(point, 9);
		map.graphics.clear();
		map.graphics.add(g);
	});
}

function getRequestDetails(id) {
	$.post(config.cwApiUrl+"ServiceRequest/ById",
	    { data:  dojo.toJson({RequestId: id}),token:token },
	    function (data) {
	    	if (data.Value.Details === "") {
	    		data.Value.Details = "No details available"
	    	}
	    	$(".modal-body").html('<span>' + data.Value.Details + '</span>');
	    	$('.modal-title').text("Problem Details Request #" + data.Value.RequestId);
	    	$('.modal').modal('show');
	    }
	);
}

function sortRequestsById (a, b) {
	return b.RequestId-a.RequestId;
}

function getRequestsByIds(ids) {
	$.post(config.cwApiUrl+"ServiceRequest/ByIds",
	    { data:  dojo.toJson({RequestIds: ids}),token:token },
	    function (data) {
	    	var tbody = $("tbody", "table").empty();
	    	if (data.Value.length > 0) {
	    		data.Value.sort(sortRequestsById);
		    	$(data.Value).each(function (i, req) {
		    		if (i > 4) {
		    			return false;
		    		}
		    		tbody.append("<tr><td>" + req.RequestId + "</td><td>" + req.Description + "</td><td>" + req.DateSubmitTo.replace("T", " at ") + "</td></td></tr>");
		    	});
	    	}

			$("tr", tbody).click(function () {
				getRequestDetails($("td", this).first().text());
			});
	    }
	);


}

function getOpenRequests(extent, sid) {
	var params = {};
	params.Extent = extent;
	if (sid > 0) {
		params.ProblemSid = [sid];
	}
	params.Status = "OPEN";
	params.Closed = false;
	params.Cancelled = false;

	$.post(config.cwApiUrl+"ServiceRequest/Search",
	    { data:  dojo.toJson(params),token:token },
	    function (data) {
	    	getRequestsByIds(data.Value);
	    }
	);
}

function facilitySelected (facility) {
	require(["esri/tasks/QueryTask", "esri/tasks/query", "esri/graphicsUtils"], function (QueryTask, Query, graphicsUtils) {

		$(".hidden1").show();

		var qt = new QueryTask(config.buildings),
			q = new Query(),
			ext,
			sid = 0;

		q.where = "LOCATION = '"+facility+"'";
		q.returnGeometry = true;
		qt.execute(q, function (fs) {
			if (fs.features.length > 0) {
				point = fs.features[0].geometry;
				map.graphics.clear();
				$(fs.features).each(function (i, f) {
					map.graphics.add(f);
				});
				if (fs.features.length > 1) {
					var extent = graphicsUtils.graphicsExtent(fs.features);
					ext = {XMax: extent.xmax, XMin: extent.xmin, YMax: extent.ymax, YMin: extent.ymax};
				} else {
					ext = {XMax: fs.features[0].geometry.x + 5, XMin: fs.features[0].geometry.x - 5, YMax: fs.features[0].geometry.y + 5, YMin: fs.features[0].geometry.y - 5};
				}

				addPointToMap(fs.features[0].geometry.x, fs.features[0].geometry.y);
				facExtent = ext;
				if ($("option:selected", "#problemSelect").val() != "prompt") {
					sid = $("option:selected", "#problemSelect").val();
				}
				getOpenRequests(ext, sid);
			}
		});
	});
}

function buildFacilityList () {
	var select = $("#facilitySelect");
	$.ajax({
		url: config.buildings,
		dataType: 'jsonp',
		data: {
			f: 'json',
			where: "WEBFORM = 'Y'",
			returnGeometry: false,
			outFields: "LOCATION",
			returnDistinctValues: true,
			orderByFields: "LOCATION"
		},
	})
	.done(function(data) {
		if (data.features.length > 0) {
			$(data.features).each(function (i, f) {
				select.append("<option>"+f.attributes.LOCATION+"</option>");
			});
		}
		select.removeProp("disabled");
	});

	select.change(function () {
		facilitySelected($("option:selected", select).val());
	});
}

function placeErrors (error, element) {
	if ($(element).parent().hasClass("form-group")) {
		$(element).parent().addClass("has-error");
		$(".help-block",$(element).parent()).show().text($(error[0]).text());
	}
	else if ($(element).parent().parent().hasClass("form-group")) {
		$(element).parent().parent().addClass("has-error");
		$(".help-block",$(element).parent()).show().text($(error[0]).text());
	} else {
		$(element).parent().parent().parent().addClass("has-error");
		$(".help-block",$(element).parent().parent().parent()).show().text($(error[0]).text());
	}
}

function removeErrors (label, element) {
	if ($(element).parent().hasClass("form-group")) {
		$(element).parent().removeClass("has-error");
		$(".help-block",$(element).parent()).hide().text("");
	}
	if ($(element).parent().parent().hasClass("form-group")) {
		$(element).parent().parent().removeClass("has-error");
		$(".help-block",$(element).parent()).hide().text("");
	} else {
		$(element).parent().parent().parent().removeClass("has-error");
		$(".help-block",$(element).parent().parent().parent()).hide().text("");
	}
}

function validateYesNo() {
	var valid = true;
	$($("input[name=yesno]").parent().parent()).each(function (i, e) {
		if ($(e).parent().hasClass("has-error")) {
			valid = false;
		}
	});
	return valid;
}

function setupValidation() {
	$.validator.addMethod("phoneUS", function(phone_number, element) {
	    phone_number = phone_number.replace(/\s+/g, "");
	    return this.optional(element) || phone_number.length > 9 &&
	        phone_number.match(/^(1-?)?(\([2-9]\d{2}\)|[2-9]\d{2})-?[2-9]\d{2}-?\d{4}$/);
	}, "Please specify a valid phone number");

	$.validator.addMethod("valueNotEquals", function(value, element, arg) {
	    return arg != value;
	}, "Selection required");

	$("form").validate({
		ignore: [],
		rules: {
			first : {
				required: true
			},
			last : {
				required: true
			},
			email : {
				required: true,
				email: true
			},
			phonenum : {
				required: true,
				phoneUS: true
			}
		},
		submitHandler: function () {
			if (validateYesNo()) {
				submitRequest();
			} else {
				alert("A required field was not entered");
			}

		},
		errorPlacement: placeErrors,
		success: removeErrors

	});
}

function addStatusInfo (form, label, value) {
	form.append('<div class="form-group">' +
	    '<label for="status" class="col-lg-3 control-label">' + label + '</label>' +
	    '<div class="col-lg-9">' +
	      '<p class="form-control-static">' + value + '</p>' +
	    '</div>' +
	'</div>');
}



function getServiceRequest (id) {

	$.post(config.cwApiUrl+"ServiceRequest/ById",
	    { data:  dojo.toJson({ RequestId: id}),token:token },
	    function (data) {
	    	$(".modal-body").empty();
	    	if (data.Value) {
		    	var form = $('<form class="form-horizontal" role="form">').appendTo(".modal-body");
		    	$('.modal-title').text("Service Request #" + data.Value.RequestId + " Status");

		    	addStatusInfo(form, 'Status', data.Value.Status);
				addStatusInfo(form, 'Submitted On', data.Value.DateSubmitTo);
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

				if (map.loaded && data.Value.SRX && data.Value.SRY) {
					addPointToMap(data.Value.SRX, data.Value.SRY);
				} else {
					map.on("load", function () {
						addServiceRequestToMap(data.Value.SRX, data.Value.SRY);
						map.off("load");
					});
				}
	    	} else {
	    		$('.modal-title').text("Service Request #" + id + " Status");
	    		$(".modal-body").html("No request found.");
	    	}
			$('.modal').modal('show');
	    }
	);
}

function checkUrlParams (obj) {
	if (obj.query) {
		if (obj.query.id) {
			getServiceRequest(obj.query.id);
		}
	}
}

$(document).ready(function () {
	getToken();
});

require(["esri/map", "esri/geometry/Point", "esri/SpatialReference", "esri/layers/ArcGISTiledMapServiceLayer", "dojo/domReady!"], function (Map, Point, SpatialReference, ArcGISTiledMapServiceLayer) {
	esri.config.defaults.io.proxyUrl = "proxy.ashx";
	var base = new ArcGISTiledMapServiceLayer(config.baseMap);
	map = new Map("map",{center : new Point(2106217, 745583, new SpatialReference(2264)),
			zoom: 3,
            logo: false,
            showAttribution: false
        });
	map.addLayer(base);
});

function init ()  {
	$("select").change(function () {
		if ($($("option", this)[0]).val() === "prompt") {
			$($("option", this)[0]).remove();
		}
	});
	buildFacilityList();
	setupValidation();

	$("#statusBtn").click(function() {
		getServiceRequest($("#statusInput").val());
	});
	if ($("html").hasClass("ie9")) {
		$("input[type=text]").ezpz_hint( {hintClass:'hintClass'});
		$("textarea").ezpz_hint( {hintClass:'hintClass'});
	}

	require(["esri/urlUtils"], function (urlUtils) {
		checkUrlParams(urlUtils.urlToObject(window.location.href));
	});
}
