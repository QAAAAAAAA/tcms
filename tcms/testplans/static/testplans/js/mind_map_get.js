let allTestCases = [];
const confirmedStatuses = [];
let testPlanId = 0;
let testPlanName = "";
let mindMapInstance = null;
let permissions = {};
const spinner = '<span class="spinner"><span>';
let activeNode = null;

$(document).ready(() => {
  const testPlanDataElement = $("#test_plan_pk");
  testPlanId = testPlanDataElement.data("testplan-pk");
  testPlanName = testPlanDataElement.data("testplan-name");

  permissions = {
    "perm-change-testcase":
      testPlanDataElement.data("perm-change-testcase") === "True",
    "perm-remove-testcase":
      testPlanDataElement.data("perm-remove-testcase") === "True",
    "perm-add-testcase":
      testPlanDataElement.data("perm-add-testcase") === "True",
    "perm-add-comment": testPlanDataElement.data("perm-add-comment") === "True",
    "perm-delete-comment":
      testPlanDataElement.data("perm-delete-comment") === "True",
  };

  jsonRPC("TestCaseStatus.filter", { is_confirmed: true }, function (statuses) {
    // save for later use
    for (let i = 0; i < statuses.length; i++) {
      confirmedStatuses.push(statuses[i].id);
    }

    jsonRPC("TestCase.filter", { plan: testPlanId }, function (data) {
      allTestCases = data;

      initMindMapWithTestCase();
      attachEvents();
    });
  });
});

const initMindMapWithTestCase = () => {
  const mindMapData = generateMindMapData(
    testPlanName,
    allTestCases,
    RECORD_TYPE.TEST_PLAN
  );

  mindMapInstance = new MindMap(mindMapData);

  $(".js-mindmap_scale_down").click(() => {
    handleScaleButtons(-1);
  });
  $(".js-mindmap_scale_up").click(() => {
    handleScaleButtons(1);
  });
};

function isTestCaseConfirmed(status) {
  return confirmedStatuses.indexOf(Number(status)) > -1;
}

function handleNodeClick(e, node) {
  hideCtxMenu();
}

function hanldeSVGMouseDown(e) {
  hideCtxMenu();
}

function handleNodeMouseUp(node, e) {
  if (e.which !== 3 || (node.children && node.children.length)) {
    return;
  }

  const tcIndex = node.nodeData.data.tcIndex;

  $(".js-ctx-menu").css({
    top: `${e.pageY + 10}px`,
    left: `${e.pageX + 10}px`,
  });

  const testCase = allTestCases[tcIndex];

  if (permissions["perm-change-testcase"]) {
    $(".js-ctx-menu-edit")[0].href = `/case/${testCase.id}/edit/`;
  }

  if (permissions["perm-add-testcase"]) {
    $(".js-ctx-menu-clone")[0].href = `/cases/clone/?c=${testCase.id}`;
  }

  mindMapInstance.activeNodeIdx = tcIndex;
  activeNode = node;
  showCtxMenu();
}

function handleScaleChange(scale) {
  $(".js-mindmap_scale_number").html((scale * 100).toFixed(0));
}

function handleScaleButtons(value) {
  if (value > 0) {
    mindMapInstance.instance.view.enlarge();
  } else {
    mindMapInstance.instance.view.narrow();
  }
}

function showCtxMenu() {
  $(".js-ctx-menu").removeClass("hidden");
}

function hideCtxMenu() {
  $(".js-ctx-menu").addClass("hidden");
  mindMapInstance.activeNodeIdx = -1;
  activeNode = null;
}

function changeNodeColorBy(statusId) {
  if (activeNode) {
    if (statusId !== 2) {
      activeNode.setStyle("fillColor", "#f2dede");
      activeNode.setStyle("lineColor", "#f2dede");
    } else {
      activeNode.setStyle("fillColor", "#fafafa");
      activeNode.setStyle("borderColor", "#fafafa");
      activeNode.setStyle("lineColor", "#549688");
    }
  }
}

function attachEvents() {
  $(".js-ctx-menu-detail").click(() => {
    if (mindMapInstance.activeNodeIdx === -1) {
      return;
    }

    $(".js-tc-detail-modal").modal("show");

    renderTestCase(allTestCases[mindMapInstance.activeNodeIdx]);
  });

  mindMapInstance.addEventHanlder({
    node_click: handleNodeClick,
    svg_mousedown: hanldeSVGMouseDown,
    node_mouseup: handleNodeMouseUp,
    scale: handleScaleChange,
  });
}

function attachEventsInModal() {
  $(".js-test-case-detail-menu-status").click(function (ev) {
    if (mindMapInstance.activeNodeIdx === -1) {
      return;
    }
    $(this).parents(".dropdown").toggleClass("open");

    $(".js-test-case-status").html(spinner);
    const statusId = parseInt(ev.target.dataset.id, 10);
    const testCaseId = allTestCases[mindMapInstance.activeNodeIdx].id;

    changeNodeColorBy(statusId);
    updateTestCasesViaAPI(
      [testCaseId],
      { case_status: statusId },
      testPlanId,
      permissions
    );
    return false;
  });

  $(".js-test-case-detail-menu-priority").click(function (ev) {
    if (mindMapInstance.activeNodeIdx === -1) {
      return;
    }
    $(this).parents(".dropdown").toggleClass("open");
    $(".js-test-case-priority").html(spinner);
    const testCaseId = allTestCases[mindMapInstance.activeNodeIdx].id;
    updateTestCasesViaAPI(
      [testCaseId],
      { priority: ev.target.dataset.id },
      testPlanId,
      permissions
    );
    return false;
  });

  $(".js-test-case-detail-menu-tester").click(function (ev) {
    if (mindMapInstance.activeNodeIdx === -1) {
      return;
    }

    $(this).parents(".dropdown").toggleClass("open");

    var emailOrUsername = window.prompt(
      $("#test_plan_pk").data("trans-username-email-prompt")
    );
    if (!emailOrUsername) {
      return false;
    }
    $(".js-test-case-tester").html(spinner);
    const testCaseId = allTestCases[mindMapInstance.activeNodeIdx].id;
    updateTestCasesViaAPI(
      [testCaseId],
      { default_tester: emailOrUsername },
      testPlanId,
      permissions
    );

    /*
      timeout to clear spinner
      in case of error
    */
    setTimeout(() => {
      if ($(".js-test-case-tester").html().toString().indexOf("spinner") > -1) {
        $(".js-test-case-tester").html(
          allTestCases[mindMapInstance.activeNodeIdx].default_tester__username
        );
      }
    }, 3000);

    return false;
  });

  if (permissions["perm-remove-testcase"]) {
    // delete testcase from the plan
    $(".js-test-case-detail-menu-delete").click(function (ev) {
      $(this).parents(".dropdown").toggleClass("open");

      const areYouSureText = $("#test_plan_pk").data("trans-are-you-sure");
      if (confirm(areYouSureText)) {
        const testCaseId = allTestCases[mindMapInstance.activeNodeIdx].id;

        jsonRPC("TestPlan.remove_case", [testPlanId, testCaseId], function () {
          // remove test case from allTestCases
          if (allTestCases.length) {
            allTestCases.splice(mindMapInstance.activeNodeIdx, 1);
          }

          // close modal
          $(".js-tc-detail-modal").modal("hide");

          // hide context menu
          hideCtxMenu();

          // regenerate mind map data
          const updatedMindMapData = generateMindMapData(
            testPlanName,
            allTestCases,
            RECORD_TYPE.TEST_PLAN
          );
          mindMapInstance.updateData(updatedMindMapData);
        });
      }

      return false;
    });
  }
}

function updateTestCasesViaAPI(
  testCaseIds,
  updateQuery,
  testPlanId,
  permissions
) {
  testCaseIds.forEach(function (caseId) {
    jsonRPC("TestCase.update", [caseId, updateQuery], function (updatedTC) {
      // update internal data
      allTestCases[mindMapInstance.activeNodeIdx] = updatedTC;
      // note: updatedTC doesn't have sortkey information

      renderTestCase(allTestCases[mindMapInstance.activeNodeIdx]);
    });
  });
}

const renderTestCase = (testCase) => {
  const {
    id,
    summary,
    case_status__name,
    priority__value,
    category__name,
    author__username,
    default_tester__username,
    reviewer__username,
    text,
    case_status,
  } = testCase;

  const testCaseRowDocumentFragment = $("#test_case_detail")[0].content;
  let modalBody = $(testCaseRowDocumentFragment.cloneNode(true));

  // clear old data
  $(".js-tc-detail-body").html("");

  markdown2HTML(text, modalBody.find(".js-test-case-expand-text"));
  if (testCase.notes.trim().length > 0) {
    modalBody.find(".js-test-case-expand-notes").html(testCase.notes);
  }
  modalBody
    .find(".js-test-case-link")
    .html(`TC-${id}: ${summary}`)
    .attr("href", `/case/${id}/`);
  modalBody.find(".js-test-case-status").html(`${case_status__name}`);
  modalBody.find(".js-test-case-priority").html(`${priority__value}`);
  modalBody.find(".js-test-case-category").html(`${category__name}`);
  modalBody.find(".js-test-case-author").html(`${author__username}`);
  modalBody
    .find(".js-test-case-tester")
    .html(`${default_tester__username || "-"}`);
  modalBody.find(".js-test-case-reviewer").html(`${reviewer__username || "-"}`);

  $(".js-tc-detail-body").append(modalBody);

  modalBody = $(".js-tc-detail-body .js-testcase-row");

  // draw the attachments
  jsonRPC("TestCase.list_attachments", [id], function (data) {
    // cannot use instance of row in the callback
    var ulElement = $(".js-tc-detail-modal .js-test-case-expand-attachments");

    // remove spinner
    ulElement.find(".spinner").remove();

    if (data.length === 0) {
      ulElement.children().removeClass("hidden");
      return;
    }

    var liElementFragment = $("#attachments-list-item")[0].content;

    for (var i = 0; i < data.length; i++) {
      //should create new element for every attachment
      var liElement = liElementFragment.cloneNode(true),
        attachmentLink = $(liElement).find("a")[0];

      attachmentLink.href = data[i].url;
      attachmentLink.innerText = data[i].url.split("/").slice(-1)[0];
      ulElement.append(liElement);
    }
  });

  // load components
  const componentTemplate = modalBody
    .find(".js-testcase-expand-components")
    .find("template")[0].content;
  jsonRPC("Component.filter", { cases: id }, function (result) {
    result.forEach(function (element) {
      const newComponent = componentTemplate.cloneNode(true);
      modalBody.find(".js-testcase-expand-components .spinner").remove();
      $(newComponent).find("span").html(element.name);
      modalBody.find(".js-testcase-expand-components").append(newComponent);
    });
  });

  // load tags
  const tagTemplate = modalBody
    .find(".js-testcase-expand-tags")
    .find("template")[0].content;
  jsonRPC("Tag.filter", { case: id }, function (result) {
    const uniqueTags = [];
    modalBody.find(".js-testcase-expand-tags .spinner").remove();

    result.forEach(function (element) {
      if (uniqueTags.indexOf(element.name) === -1) {
        uniqueTags.push(element.name);

        const newTag = tagTemplate.cloneNode(true);
        $(newTag).find("span").html(element.name);
        modalBody.find(".js-testcase-expand-tags").append(newTag);
      }
    });
  });

  // render previous comments
  const commentTemplate = $("template#comment-template")[0];

  jsonRPC("TestCase.comments", [id], (comments) => {
    const parentNode = modalBody.find(".comments");
    modalBody.find(".comments .spinner").remove();
    comments.forEach((comment, index) =>
      parentNode.append(renderCommentHTML(index + 1, comment, commentTemplate))
    );

    bindDeleteCommentButton(
      id,
      "TestCase.remove_comment",
      !isTestCaseConfirmed(case_status) && permissions["perm-delete-comment"],
      parentNode
    );
  });

  // render comments form
  const commentFormTextArea = modalBody.find(".js-comment-form-textarea");
  if (!isTestCaseConfirmed(case_status) && permissions["perm-add-comment"]) {
    const textArea = modalBody.find("textarea")[0];
    const fileUpload = $('input[type="file"]');
    const editor = initSimpleMDE(textArea, $(fileUpload), textArea.id);

    modalBody.find(".js-post-comment").click(function (event) {
      event.preventDefault();
      const input = editor.value().trim();

      if (input) {
        jsonRPC("TestCase.add_comment", [id, input], (comment) => {
          editor.value("");

          // show the newly added comment and bind its delete button
          modalBody.find(".comments").append(
            renderCommentHTML(
              1 + modalBody.find(".js-comment-container").length,
              comment,
              $("template#comment-template")[0],
              function (parentNode) {
                bindDeleteCommentButton(
                  id,
                  "TestCase.remove_comment",
                  permissions["perm-delete-comment"], // b/c we already know it's unconfirmed
                  parentNode
                );
              }
            )
          );
        });
      }
    });
  } else {
    commentFormTextArea.hide();
  }

  // append action for menu items
  if (permissions["perm-add-testcase"]) {
    modalBody.find(
      ".js-test-case-detail-menu-clone"
    )[0].href = `/cases/clone/?c=${id}`;
  }

  if (permissions["perm-change-testcase"]) {
    modalBody.find(".js-test-case-detail-menu-edit")[0].href = `/case/${
      allTestCases[mindMapInstance.activeNodeIdx].id
    }/edit/`;
  }

  if (!isTestCaseConfirmed(case_status)) {
    // add customizable icon as part of #1932
    modalBody.find(".js-test-case-status-icon").addClass("fa-times");

    modalBody.find(".js-test-case-tester-div").toggleClass("hidden");
    modalBody.find(".js-test-case-reviewer-div").toggleClass("hidden");
  } else {
    modalBody.find(".js-test-case-status-icon").addClass("fa-check-square");
  }

  if (!isTestCaseConfirmed(case_status)) {
    $(".mind-map__modal__header").addClass("bg-danger");
    $(".js-tc-detail-body").addClass("bg-danger");

    // add customizable icon as part of #1932
    modalBody.find(".js-test-case-status-icon").addClass("fa-times");

    modalBody.find(".js-test-case-tester-div").toggleClass("hidden");
    modalBody.find(".js-test-case-reviewer-div").toggleClass("hidden");
  } else {
    modalBody.find(".js-test-case-status-icon").addClass("fa-check-square");
    $(".mind-map__modal__header").removeClass("bg-danger");
    $(".js-tc-detail-body").removeClass("bg-danger");
  }

  attachEventsInModal();
};

function change_testplan_status(){
    jsonRPC('TestPlan.get_active_status', testPlanId, function(active_status) {
        jsonRPC('TestPlan.update', [testPlanId, {"is_active": !active_status}], function(data) {
            location.reload();
        });
    });
}
