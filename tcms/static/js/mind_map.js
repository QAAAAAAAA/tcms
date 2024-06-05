const RECORD_TYPE = {
  TEST_PLAN: 1,
  TEST_RUN: 2,
};
class MindMap {
  constructor(data) {
    if (!simpleMindMap) {
      throw new Error("missing mind map module");
    }

    this.activeNodeIdx = -1;
    const mindMapEle = $("#mindmap")[0];
    this.instance = new simpleMindMap.default({
      el: mindMapEle,
      data,
      readonly: true,
      layout: "mindMap",
    });
  }

  addEventHanlder(handlers) {
    [
      "node_active",
      "data_change",
      "view_data_change",
      "back_forward",
      "node_contextmenu",
      "node_click",
      "draw_click",
      "expand_btn_click",
      "svg_mousedown",
      "mouseup",
      "node_mouseup",
      "mode_change",
      "node_tree_render_end",
      "node_dblclick",
      "scale",
    ].forEach((event) => {
      this.instance.on(event, (...args) => {
        if (handlers[event]) {
          handlers[event](...args);
        }
      });
    });
  }

  updateData(data) {
    this.instance.setData(data);
  }
}

function applyStatusColor(mindMapNode, tcmsRecord, type) {
  let status = -1

  if (type === RECORD_TYPE.TEST_PLAN) {
    status = tcmsRecord.case_status
  } else {
    status = tcmsRecord.status
  }

  let needRedBg = false;
  if (type === RECORD_TYPE.TEST_PLAN) {
    // not CONFIRMED
    if (status !== 2) {
      needRedBg = true;
    }
  } else if (type == RECORD_TYPE.TEST_RUN) {
    // not PASSED or WAIVED
    if (status !== 4 && status !== 8) {
      needRedBg = true;
    }
  }

  if (needRedBg) {
    mindMapNode.data["fillColor"] = "#f2dede"
    mindMapNode.data["lineColor"] = "#f2dede"
  }

  return mindMapNode;
}

function generateMindMapData(rootName, allTestCases, type) {
  const mindMapData = {
    data: {
      text: rootName,
    },
    children: [],
  };

  allTestCases.forEach((each, index) => {
    const { summary, category__name } = each;

    if (category__name === "--default--") {
      // direct child of root node
      const node = {
        data: {
          text: decodeHTMLEntities(summary),
          tcIndex: index,
          borderWidth: 0,
          fillColor: "#fafafa",
          borderColor: "#fafafa",
        },
        children: [],
      };
      mindMapData.children.push(applyStatusColor(node, each, type));
      return;
    }

    const categories = category__name.split("/");

    let prev = mindMapData.children;
    categories.forEach((cat) => {
      const trimmed = cat.trim();
      if (!prev) {
        prev = [];
      }

      // find that item in children
      let itemIndex = -1;

      for (let i = 0; i < prev.length; i++) {
        const {
          data: { text },
        } = prev[i];

        if (text === trimmed) {
          itemIndex = i;
          break;
        }
      }

      if (itemIndex == -1) {
        prev.push({
          data: {
            text: decodeHTMLEntities(trimmed),
            borderWidth: 1,
            borderColor: "#0C797D",
            borderDasharray: "5,5",
            fillColor: "#fafafa",
          },
          children: [],
        });

        prev = prev[prev.length - 1].children;
      } else {
        prev = prev[itemIndex].children;
      }
    });

    const node = {
      data: {
        text: decodeHTMLEntities(summary),
        fontSize: 16,
        tcIndex: index,
        borderWidth: 0,
        fillColor: "#fafafa",
        borderColor: "#fafafa",
      },
      children: [],
    };

    prev.push(applyStatusColor(node, each, type));
  });

  return mindMapData;
}

function decodeHTMLEntities(text) {
  var entities = [
    ["amp", "&"],
    ["apos", "'"],
    ["#x27", "'"],
    ["#x2F", "/"],
    ["#39", "'"],
    ["#47", "/"],
    ["lt", "<"],
    ["gt", ">"],
    ["nbsp", " "],
    ["quot", '"'],
  ];

  for (var i = 0, max = entities.length; i < max; ++i)
    text = text.replace(
      new RegExp("&" + entities[i][0] + ";", "g"),
      entities[i][1]
    );

  return text;
}
