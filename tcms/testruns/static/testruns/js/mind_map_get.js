const permissions = {
  removeTag: false,
  addComment: false,
  removeComment: false,
};
let testRunId = -1;
const allExecutionStatuses = {};
let allExecutions = [];
let testRunName = "";
let mindMapInstance = null;
const links = {};
const testCases = {};
const components = {};
const tags = {};
const casesInPlan = {};
const queryingState = {
  status: false,
};
const spinner = '<span class="spinner"><span>';
let activeNode = null;

const testStartBtn = (e) => {
  const timeZone = $("#clock").data("time-zone");
  const now = currentTimeWithTimezone(timeZone);

  jsonRPC("TestRun.update", [testRunId, { start_date: now }], (testRun) => {
    const startDate = moment(testRun.start_date).format("DD MMM YYYY, HH:mm a");
    $(".start-date").html(startDate);
    $(e.currentTarget).hide();
  });
};

const testStopBtn = (e) => {
  const timeZone = $("#clock").data("time-zone");
  const now = currentTimeWithTimezone(timeZone);

  jsonRPC("TestRun.update", [testRunId, { stop_date: now }], (testRun) => {
    const stopDate = moment(testRun.stop_date).format("DD MMM YYYY, HH:mm a");
    $(".stop-date").html(stopDate);
    $(e.currentTarget).hide();
    $("#test_run_pk").parent("h1").css({ "text-decoration": "line-through" });
  });
};

const testExecutionQuery = () => {
  return new Promise((resolve) => {
    jsonRPC("TestExecutionStatus.filter", {}, (executionStatuses) => {
      // convert from list to a dict for easier indexing later
      for (let i = 0; i < executionStatuses.length; i++) {
        allExecutionStatuses[executionStatuses[i].id] = executionStatuses[i];
      }

      const rpcQuery = { run_id: testRunId };

      // if page has URI params then try filtering, e.g. by status
      const filterParams = new URLSearchParams(location.search);
      if (filterParams.has("status_id")) {
        rpcQuery.status_id__in = filterParams.getAll("status_id");
      }

      jsonRPC("TestExecution.filter", rpcQuery, (testExecutions) => {
        resolve(testExecutions);
      });
    });
  });
};

const addCCHanlder = () => {
  const username = prompt(
    $("#test_run_pk").data("trans-enter-assignee-name-or-email")
  );

  if (!username) {
    return false;
  }

  jsonRPC("TestRun.add_cc", [testRunId, username], (result) => {
    // todo: instead of reloading render this in the form above
    window.location.reload(true);
  });
};

const removeCCHanlder = (event) => {
  e.preventDefault();
  const uid = $(event.target).parent("[data-uid]").data("uid");

  jsonRPC("TestRun.remove_cc", [testRunId, uid], (result) => {
    $(event.target).parents("tr").hide();
  });
};

const drawPercentBar = (testExecutions) => {
  let positiveCount = 0;
  let negativeCount = 0;
  const allCount = testExecutions.length;
  const statusCount = {};
  Object.values(allExecutionStatuses).forEach(
    (s) => (statusCount[s.name] = { count: 0, id: s.id })
  );

  testExecutions.forEach((testExecution) => {
    const executionStatus = allExecutionStatuses[testExecution.status];

    if (executionStatus.weight > 0) {
      positiveCount++;
    } else if (executionStatus.weight < 0) {
      negativeCount++;
    }

    statusCount[executionStatus.name].count++;
  });

  renderProgressBars('execution', positiveCount, negativeCount, allCount);
  renderCountPerStatusList(statusCount);
};

const drawBugPercentBar = (testExecutions) => {
  let positiveCount = 0
  let negativeCount = 0
  let allCount = 0
  const ids = {}
  testExecutions.forEach(testExecution =>
    jsonRPC('TestExecution.get_links', { execution_id: testExecution.id }, links => {
      links.forEach(link => 
        jsonRPC('Bug.details', link.url, data => {
          const myArr = data.description.split(" ");
          var bug_status = myArr[1].replace(/(?:\r\n|\r|\n)/g, " ")
          
          if(bug_status.toLowerCase().includes('closed') || bug_status.toLowerCase().includes('done')){
            positiveCount++
          } else {
            negativeCount++
          }
          allCount++

          if(ids.hasOwnProperty(bug_status)){
            ids[bug_status]++
          } else {
            ids[bug_status] = 1
          }
        }, true)
        )
    }, true)
  )

  renderProgressBars('bug', positiveCount, negativeCount, allCount)

  for (const [key, value] of Object.entries(ids)) {
    $('.count-per-bug-container').append(`<li class="list-group-item" style="padding:0; text-align:left"><label>${key}</label> - ${value}</li>`)
  }

  $('.total-bug-count').text(allCount)
};

const renderCountPerStatusList = (statusCount) => {
  for (const status in statusCount) {
    const statusId = statusCount[status].id;

    $(`#count-for-status-${statusId}`)
      .attr("href", `?status_id=${statusId}`)
      .text(statusCount[status].count);
  }
};

const renderProgressBars = (renderType, positiveCount, negativeCount, allCount) => {
  if(renderType === 'bug'){
    positiveBar = $('.progress > .progress-completed-bug')
    negativeBar = $('.progress > .progress-failed-bug')
    neutralBar = $('.progress > .progress-bar-remaining-bug')
  } else {
    positiveBar = $('.progress > .progress-completed')
    negativeBar = $('.progress > .progress-failed')
    neutralBar = $('.progress > .progress-bar-remaining')
  }

  const positivePercent = +((positiveCount / allCount) * 100).toFixed(2);
  // const positiveBar = $(".progress > .progress-completed");
  if (positivePercent) {
    positiveBar.text(`${positivePercent}%`);
  }
  positiveBar.css("width", `${positivePercent}%`);
  positiveBar.attr("aria-valuenow", `${positivePercent}`);

  const negativePercent = +((negativeCount / allCount) * 100).toFixed(2);
  // const negativeBar = $(".progress > .progress-failed");
  if (negativePercent) {
    negativeBar.text(`${negativePercent}%`);
  }
  negativeBar.css("width", `${negativePercent}%`);
  negativeBar.attr("aria-valuenow", `${negativePercent}`);

  const neutralPercent = +(100 - (negativePercent + positivePercent)).toFixed(
    2
  );
  // const neutralBar = $(".progress > .progress-bar-remaining");
  if (neutralPercent) {
    neutralBar.text(`${neutralPercent}%`);
  }
  neutralBar.css("width", `${neutralPercent}%`);
  neutralBar.attr("aria-valuenow", `${neutralPercent}`);

  $(".total-execution-count").text(allCount);
};

const mergeExecutionWithTestCase = (testExecution) => {
  const { id, case: caseId } = testExecution;
  const {
    category__name,
    summary,
    text,
    notes,
    priority__value,
    is_automated,
  } = testCases[caseId];

  const result = {
    ...testExecution,
    category__name,
    summary,
    text,
    tags: tags[caseId] || [],
    tag_names: (tags[caseId] || []).map((each) => {
      return each.name;
    }),
    components: components[caseId] || [],
    component_names: (components[caseId] || []).map((each) => {
      return each.name;
    }),
    links: !!links[id],
    is_in_plan: !!casesInPlan[caseId],
    notes,
    priority__value,
    is_automated,
  };

  return result;
};

function fetchAdditionalInformation(testRunId, execution, callback) {
  let linksQuery = { execution__run: testRunId };
  let casesQuery = { executions__run: testRunId };
  let componentQ = { cases__executions__run: testRunId };
  let tagsQ = { case__executions__run: testRunId };
  const planId = Number($("#test_run_pk").data("plan-pk"));

  // if called from reloadRowFor(execution) then filter only for
  // that one row
  if (execution) {
    casesQuery = { executions: execution.id };
    componentQ = { cases__executions: execution.id };
    tagsQ = { case__executions: execution.id };
    linksQuery = { execution: execution.id };
  }

  // update bug icons for all executions
  jsonRPC("TestExecution.get_links", linksQuery, (qlinks) => {
    // update priority, category & automation status for all executions
    // also tags & components via nested API calls
    jsonRPC("Component.filter", componentQ, (qComponents) => {
      jsonRPC("Tag.filter", tagsQ, (qTags) => {
        jsonRPC("TestCase.filter", casesQuery, (qTestCases) => {
          jsonRPC("TestCase.filter", { plan: planId }, function (qCasesInPlan) {
            qlinks.forEach((link) => {
              if (link.is_defect) {
                links[link.execution] = link;
              }
            });
            qComponents.forEach((each) => {
              if (components[each.cases]) {
                components[each.cases].push(each);
              } else {
                components[each.cases] = [each];
              }
            });

            qTags.forEach((each) => {
              if (tags[each.case]) {
                tags[each.case].push(each);
              } else {
                tags[each.case] = [each];
              }
            });

            qTestCases.forEach((each) => {
              testCases[each.id] = each;
            });

            qCasesInPlan.forEach((each) => {
              casesInPlan[each.id] = 1;
            });

            // merge test case + test execution + tag + component data
            allExecutions = allExecutions.map((each) => {
              return mergeExecutionWithTestCase(each);
            });

            if (callback) {
              callback();
            }
          });
        });
      });
    });
  });
}

function handleScaleButtons(value) {
  if (value > 0) {
    mindMapInstance.instance.view.enlarge();
  } else {
    mindMapInstance.instance.view.narrow();
  }
}

const initMindMapWithTestCase = () => {
  const mindMapData = generateMindMapData(
    testRunName,
    allExecutions,
    RECORD_TYPE.TEST_RUN
  );

  mindMapInstance = new MindMap(mindMapData);

  $(".js-mindmap_scale_down").click(() => {
    handleScaleButtons(-1);
  });
  $(".js-mindmap_scale_up").click(() => {
    handleScaleButtons(1);
  });
};

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
    if (statusId !== 4 && statusId !== 8) {
      activeNode.setStyle("fillColor", "#f2dede");
      activeNode.setStyle("lineColor", "#f2dede");
    } else {
      activeNode.setStyle("fillColor", "#fafafa");
      activeNode.setStyle("borderColor", "#fafafa");
      activeNode.setStyle("lineColor", "#549688");
    }
  }
}

function changeModalColorBy(statusId) {
  if (statusId !== 4 && statusId !== 8) {
    $(".mind-map__modal__header").addClass("bg-danger");
    $(".js-tc-detail-body").addClass("bg-danger");
  } else {
    $(".mind-map__modal__header").removeClass("bg-danger");
    $(".js-tc-detail-body").removeClass("bg-danger");
  }
}

function setActiveStatusInCtx(status) {
  const allStatus = $(".ctx-menu-change-status");
  for (let i = 0; i < allStatus.length; i++) {
    const element = allStatus[i];
    const current = $(element).attr("data-status-id");

    if (current == status) {
      $(element).addClass("active");
    } else {
      $(element).removeClass("active");
    }
  }
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

  const testExecution = allExecutions[tcIndex];
  const { status } = testExecution;

  mindMapInstance.activeNodeIdx = tcIndex;
  activeNode = node;
  // activate correct status
  setActiveStatusInCtx(status);
  showCtxMenu();
}

function handleScaleChange(scale) {
  $(".js-mindmap_scale_number").html((scale * 100).toFixed(0));
}

function changeStatusWithCtxMenu(statusId, selectedIndex) {
  return new Promise((resolve, reject) => {
    const testExecution = allExecutions[selectedIndex];
    const { id: executionId } = testExecution;
    queryingState.status = true;
    setActiveStatusInCtx(statusId);

    jsonRPC(
      "TestExecution.update",
      [
        executionId,
        {
          status: statusId,
        },
      ],
      (execution) => {
        resolve(execution);
      }
    );
  });
}

function deleteTestExecution(selectedIndex) {
  return new Promise((resolve) => {
    const testExecution = allExecutions[selectedIndex];
    const { id: executionId } = testExecution;

    // jsonRPC(
    //   "TestRun.remove_case",
    //   [testRunId, executionId],
    //   () => {
    //     resolve(true);
    //   },
    //   true
    // );
    setTimeout(() => {
      resolve(true);
    }, 3000);
  });
}

function toggleSpinner() {
  $(".js-mind-map-container__backdrop").toggleClass("hidden");
}

function attachEvents() {
  $(".js-ctx-menu-detail").click(() => {
    if (mindMapInstance.activeNodeIdx === -1) {
      return;
    }

    $(".js-tc-detail-modal").modal("show");

    renderTestExecution(allExecutions[mindMapInstance.activeNodeIdx]);
  });

  $(".ctx-menu-change-status").click((e) => {
    e.preventDefault();
    if ($(e.currentTarget).hasClass("active") || queryingState.status) {
      return;
    }

    $(e.currentTarget).append(spinner);
    const statusId = parseInt($(e.currentTarget).attr("data-status-id"), 10);
    changeNodeColorBy(statusId);
    const selectedIndex = mindMapInstance.activeNodeIdx;

    changeStatusWithCtxMenu(statusId, selectedIndex).then((execution) => {
      allExecutions[selectedIndex] = mergeExecutionWithTestCase(execution);
      queryingState.status = false;
      $(e.currentTarget).find($(".spinner")).remove();
      drawPercentBar(allExecutions);
      drawBugPercentBar(allExecutions);
    });
  });

  $(".js-ctx-menu-delete").click(function () {
    const areYouSureText = $("#test_run_pk").data("trans-are-you-sure");
    if (confirm(areYouSureText)) {
      const selectedIndex = mindMapInstance.activeNodeIdx;
      toggleSpinner();
      hideCtxMenu();
      deleteTestExecution(selectedIndex).then(() => {
        if (allExecutions.length) {
          allExecutions.splice(selectedIndex, 1);
        }

        // regenerate mind map data
        const updatedMindMapData = generateMindMapData(
          testRunName,
          allExecutions,
          RECORD_TYPE.TEST_PLAN
        );
        mindMapInstance.updateData(updatedMindMapData);
        toggleSpinner();
      });
    }
  });

  mindMapInstance.addEventHanlder({
    node_click: handleNodeClick,
    svg_mousedown: hanldeSVGMouseDown,
    node_mouseup: handleNodeMouseUp,
    scale: handleScaleChange,
  });
}

function changeStatus(testExecutionId, statusId) {
  return new Promise((resolve) => {
    jsonRPC(
      "TestExecution.update",
      [
        testExecutionId,
        {
          status: statusId,
        },
      ],
      (execution) => {
        resolve(execution);
      }
    );
  });
}

function renderLink(link) {
  return new Promise((resolve) => {
    const linkEntryTemplate = $("#link-entry")[0].content;
    const template = $(linkEntryTemplate.cloneNode(true));

    const linkUrlEl = template.find(".link-url");
    linkUrlEl.html(link.name || link.url);
    linkUrlEl.attr("href", link.url);

    jsonRPC(
      "Bug.details",
      link.url,
      (data) => {
        data = {
          title: "[TMS 5.4][GA][M2.1][BE] Position search API bug",
          description:
            "status: Done | reporter: weilun.foo@shopee.com | assignee: weilun.foo@shopee.com | priority: Medium | updated: 2022-10-28T11:02:38.000+0800",
        };

        if (link.is_defect) {
          template.find(".link-icon").addClass("fa fa-bug");
          const bugTooltip = template.find(".bug-tooltip");
          bugTooltip.css("visibility", "visible");

          template
            .find("[data-toggle=popover]")
            .popovers()
            .on("show.bs.popover", () => {
              $(bugTooltip).attr("data-original-title", data.title);
              $(bugTooltip).attr("data-content", data.description);
            });
        }
        const myArr = data.description.split(" ");
        const linkStatusEl = template.find(".link-status");
        linkStatusEl.html(myArr[1]);
        linkStatusEl.attr("a", myArr[1]);

        resolve(template);
      },
      true
    );
  });
}

function renderHistoryEntry(historyEntry) {
  if (!historyEntry.history_change_reason) {
    return "";
  }

  const template = $($("#history-entry")[0].content.cloneNode(true));

  template.find(".history-date").html(historyEntry.history_date);
  template.find(".history-user").html(historyEntry.history_user__username);

  // convert to markdown code block for the diff language
  const changeReason = `\`\`\`diff\n${historyEntry.history_change_reason}\n\`\`\``;
  markdown2HTML(changeReason, template.find(".history-change-reason")[0]);

  return template;
}

const renderTestExecution = (testExecution) => {
  const {
    id,
    priority__value,
    category__name,
    text,
    case__summary,
    case: case_id,
    tested_by__username,
    assignee__username,
    is_automated,
    links,
    component_names,
    tag_names,
    status,
    is_in_plan,
    close_date,
    // build__name,
    case_text_version,
    notes,
  } = testExecution;

  const testCaseRowDocumentFragment = $("#test_case_detail")[0].content;
  let modalBody = $(testCaseRowDocumentFragment.cloneNode(true));
  const commentsRow = modalBody.find(".comments");
  const commentTemplate = $("template#comment-template")[0];

  const changeStatusView = (testExecutionStatus) => {
    const content = $(".js-tc-detail-body .js-testcase-row");
    content
      .find(".test-execution-status-icon")
      .addClass(testExecutionStatus.icon)
      .css("color", testExecutionStatus.color);
    content
      .find(".test-execution-status-name")
      .html(testExecutionStatus.name)
      .css("color", testExecutionStatus.color);
  };

  // clear old data
  $(".js-tc-detail-body").html("");
  $(".js-tc-detail-body").append(modalBody);
  modalBody = $(".js-tc-detail-body .js-testcase-row");

  markdown2HTML(text, modalBody.find(".js-test-case-expand-text"));
  if (notes.trim().length > 0) {
    modalBody.find(".js-test-case-expand-notes").html(notes);
  }
  modalBody
    .find(".js-test-execution-information .run-date")
    .html(close_date || "-");
  // modalBody.find(".js-test-execution-information .build").html(build__name);
  modalBody
    .find(".js-test-execution-information .text-version")
    .html(case_text_version);
  modalBody.find(".js-test-execution-info").html(`TE-${id}`);
  modalBody
    .find(".js-test-execution-info-link")
    .html(`TE-${case__summary}`)
    .attr("href", `/case/${case_id}/`);
  modalBody.find(".js-test-execution-tester").html(tested_by__username || "-");
  modalBody.find(".js-test-execution-asignee").html(assignee__username || "-");
  modalBody.find(".js-test-execution-priority").html(priority__value);
  modalBody.find(".js-test-execution-category").html(category__name);
  changeStatusView(allExecutionStatuses[status]);
  const isAutomatedElement = modalBody.find(".js-test-execution-automated");
  const isAutomatedIcon = is_automated ? "fa-cog" : "fa-thumbs-up";
  const isAutomatedAttr = is_automated
    ? isAutomatedElement.data("automated")
    : isAutomatedElement.data("manual");
  isAutomatedElement.addClass(isAutomatedIcon);
  isAutomatedElement.attr("title", isAutomatedAttr);
  if (links) {
    modalBody.find(".js-bugs").removeClass("hidden");
  }
  if (tag_names.length) {
    modalBody.find(".js-row-tags").toggleClass("hidden");
    modalBody.find(".js-row-tags").append(tag_names.join(", "));
  }
  if (component_names.length) {
    modalBody.find(".js-row-components").toggleClass("hidden");
    modalBody.find(".js-row-components").append(component_names.join(", "));
  }
  // WARNING: only comments related stuff below
  if (!permissions.addComment) {
    modalBody.find(".comment-form").hide();
  }
  // test case isn't part of the parent test plan
  if (!is_in_plan) {
    modalBody.find(".js-tc-not-in-tp").toggleClass("hidden");
  }

  // get test execution HTML notes
  jsonRPC(
    "TestCase.history",
    [
      case_id,
      {
        history_id: case_text_version,
      },
    ],
    (data) => {
      data.forEach((entry) => {
        markdown2HTML(entry.text, modalBody.find(".js-test-execution-text")[0]);
        modalBody.find(".js-test-execution-notes").append(entry.notes);
      });
    }
  );

  jsonRPC("TestExecution.get_comments", [id], (comments) => {
    modalBody.find(".comments .spinner").remove();
    comments.forEach((comment, index) =>
      commentsRow.append(renderCommentHTML(index + 1, comment, commentTemplate))
    );

    bindDeleteCommentButton(
      id,
      "TestExecution.remove_comment",
      permissions.removeComment,
      commentsRow
    );
  });
  const simpleMDEinitialized = modalBody
    .find(".comment-form")
    .data("simple-mde-initialized");

  if (!simpleMDEinitialized) {
    const textArea = modalBody.find("textarea")[0];
    const fileUpload = modalBody.find('input[type="file"]');
    const editor = initSimpleMDE(textArea, $(fileUpload), textArea.id);
    modalBody.find(".comment-form").data("simple-mde-initialized", true);
    modalBody.find(".post-comment").click(() => {
      const input = editor.value().trim();

      if (input) {
        jsonRPC("TestExecution.add_comment", [id, input], (comment) => {
          editor.value("");

          commentsRow.append(
            renderCommentHTML(
              1 + modalBody.find(".js-comment-container").length,
              comment,
              $("template#comment-template")[0],
              (parentNode) => {
                bindDeleteCommentButton(
                  id,
                  "TestExecution.remove_comment",
                  permissions.removeComment,
                  parentNode
                );
              }
            )
          );
        });
      }
    });

    modalBody.find(".change-status-button").click(function () {
      const statusId = parseInt($(this).attr("data-status-id"), 10);
      changeNodeColorBy(statusId);
      changeModalColorBy(statusId);
      $(".test-execution-status-name").html(spinner);

      const input = editor.value().trim();
      jsonRPC("TestExecution.add_comment", [id, input], (comment) => {
        editor.value("");
        commentsRow.append(
          renderCommentHTML(
            1 + modalBody.find(".js-comment-container").length,
            comment,
            $("template#comment-template")[0],
            (parentNode) => {
              bindDeleteCommentButton(
                id,
                "TestExecution.remove_comment",
                permissions.removeComment,
                parentNode
              );
            }
          )
        );
      });

      modalBody.find(".test-execution-status-icon").html("");
      modalBody
        .find(".test-execution-status-icon")
        .attr("class", "fa test-execution-status-icon");
      modalBody.find(".test-execution-status-name").html(spinner);

      changeStatus(id, statusId).then((execution) => {
        const newExecution = mergeExecutionWithTestCase(execution);
        allExecutions[mindMapInstance.activeNodeIdx] = newExecution;
        drawPercentBar(allExecutions);
        drawBugPercentBar(allExecutions);
        changeStatusView(allExecutionStatuses[statusId]);
      });
    });
  }

  jsonRPC("TestExecution.get_links", { execution_id: id }, (links) => {
    const ul = modalBody.find(".js-test-execution-hyperlinks");
    ul.find(".spinner").remove();
    ul.innerHTML = "";
    links.forEach(async (link) => {
      const linkTemplate = await renderLink(link);
      ul.append(linkTemplate);
    });
  });

  jsonRPC("TestCase.list_attachments", [case_id], (attachments) => {
    const ul = modalBody.find(".js-test-case-attachments");
    ul.find(".spinner").remove();

    if (!attachments.length) {
      ul.find(".hidden").removeClass("hidden");
      return;
    }

    const liTemplate = $("#attachments-list-item")[0].content;

    attachments.forEach((attachment) => {
      const li = liTemplate.cloneNode(true);
      const attachmentLink = $(li).find("a")[0];

      attachmentLink.href = attachment.url;
      attachmentLink.innerText = attachment.url.split("/").slice(-1)[0];
      ul.append(li);
    });
  });

  jsonRPC("TestExecution.history", id, (history) => {
    const historyContainer = modalBody.find(".history-container");
    historyContainer.find(".spinner").remove();
    history.forEach((h) => {
      historyContainer.append(renderHistoryEntry(h));
    });
  });

  changeModalColorBy(status);
};

$(document).ready(() => {
  permissions.removeTag = $("#test_run_pk").data("perm-remove-tag") === "True";
  permissions.addComment =
    $("#test_run_pk").data("perm-add-comment") === "True";
  permissions.removeComment =
    $("#test_run_pk").data("perm-remove-comment") === "True";
  const testRunDataElement = $("#test_run_pk");
  testRunName = testRunDataElement.data("testrun-name");
  testRunId = $("#test_run_pk").data("pk");

  $("#start-button").on("click", testStartBtn);
  $("#stop-button").on("click", testStopBtn);
  tagsCard("TestRun", testRunId, { run: testRunId }, permissions.removeTag);
  testExecutionQuery().then((testExecutions) => {
    allExecutions = testExecutions;

    drawPercentBar(allExecutions);
    drawBugPercentBar(allExecutions);
    fetchAdditionalInformation(testRunId, null, () => {
      initMindMapWithTestCase();
      attachEvents();
      toggleSpinner();
    });
  });

  // email notifications card
  $("#add-cc").click(addCCHanlder);
  $(".js-remove-cc").click(removeCCHanlder);
});
