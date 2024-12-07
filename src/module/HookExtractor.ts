import * as acorn from "acorn";
import * as espree from "espree";
import * as walk from "acorn-walk";

class UniqueIdGenerator {
  private prefix: string;
  private id: number;

  constructor(prefix: string = "") {
    this.prefix = prefix;
    this.id = 0;
  }

  public next() {
    this.id += 1;
    return `${this.prefix}_${this.id}`;
  }
}

export class ComponentNode {
  private static idGenerator = new UniqueIdGenerator("component");

  readonly id: string;
  readonly path: string;
  readonly fileAst: acorn.Node;
  readonly node: acorn.Node;

  name: string;
  props: PropNode[];
  states: StateNode[];
  effects: EffectNode[];
  children: ComponentNode[];
  falseChildren: ComponentNode[];

  constructor(
    name: string,
    path: string,
    fileAst: acorn.Node,
    node: acorn.Node
  ) {
    this.id = ComponentNode.idGenerator.next();
    this.name = name;
    this.path = path;
    this.props = [];
    this.states = [];
    this.effects = [];
    this.children = [];
    this.falseChildren = [];
    this.fileAst = fileAst;
    this.node = node;
  }

  public visitChildren(callback: (node: ComponentNode) => void) {
    for (const child of this.children) {
      callback(child);
      child.visitChildren(callback);
    }
  }

  public getStateById(id: string) {
    return this.states.find((state) => state.id === id);
  }

  public getStateByName(name: string) {
    return this.states.find((state) => state.name === name);
  }

  public getPropById(id: string) {
    return this.props.find((prop) => prop.id === id);
  }

  public getPropByName(name: string) {
    return this.props.find((prop) => prop.name === name);
  }

  public getChildById(id: string) {
    return this.children.find((child) => child.id === id);
  }
}

export class StateNode {
  private static idGenerator = new UniqueIdGenerator("state");

  readonly id: string;
  readonly name: string;
  readonly root: ComponentNode;
  readonly setter: string;

  constructor(name: string, root: ComponentNode, setter: string) {
    this.id = StateNode.idGenerator.next();
    this.name = name;
    this.root = root;
    this.setter = setter;
  }
}

export class PropNode {
  private static idGenerator = new UniqueIdGenerator("prop");

  readonly id: string;
  readonly name: string;
  readonly root: ComponentNode;

  references: string[];

  constructor(name: string, root: ComponentNode) {
    this.id = PropNode.idGenerator.next();
    this.name = name;
    this.references = [];
    this.root = root;
  }
}

export class EffectNode {
  private static idGenerator = new UniqueIdGenerator("effect");

  readonly id: string;
  readonly name: string;
  readonly root: ComponentNode;
  readonly body: acorn.Node;
  readonly dependencyIds: string[];

  constructor(
    name: string,
    root: ComponentNode,
    body: acorn.Node,
    dependencyIds: string[]
  ) {
    this.id = EffectNode.idGenerator.next();
    this.name = name;
    this.root = root;
    this.body = body;
    this.dependencyIds = dependencyIds;
  }
}

// From acorn-jsx-walk
function extend(base: any) {
  if (base === void 0) base = {};

  base.JSXExpressionContainer = base.ExpressionStatement;
  base.JSXSpreadChild = base.ExpressionStatement;
  base.JSXClosingFragment = base.Identifier;
  base.JSXEmptyExpression = base.Identifier;
  base.JSXIdentifier = base.Identifier;
  base.JSXOpeningFragment = base.Identifier;
  base.JSXText = base.Identifier;
  base.JSXSpreadAttribute = base.SpreadElement;

  base.JSXAttribute = function (node: any, state: any, callback: any) {
    callback(node.name, state);
    if (node.value) {
      callback(node.value, state);
    }
  };

  base.JSXMemberExpression = function (node: any, state: any, callback: any) {
    callback(node.object, state);
    callback(node.property, state);
  };

  base.JSXNamespacedName = function (node: any, state: any, callback: any) {
    callback(node.namespace, state);
    callback(node.name, state);
  };

  base.JSXOpeningElement = function (node: any, state: any, callback: any) {
    callback(node.name, state);
    for (var i = 0; i < node.attributes.length; ++i) {
      callback(node.attributes[i], state);
    }
  };

  base.JSXClosingElement = function (node: any, state: any, callback: any) {
    callback(node.name, state);
  };

  base.JSXElement = function (node: any, state: any, callback: any) {
    callback(node.openingElement, state);
    for (var i = 0; i < node.children.length; ++i) {
      callback(node.children[i], state);
    }
    if (node.closingElement) {
      callback(node.closingElement, state);
    }
  };

  base.JSXFragment = function (node: any, state: any, callback: any) {
    callback(node.openingFragment, state);
    for (var i = 0; i < node.children.length; ++i) {
      callback(node.children[i], state);
    }
    callback(node.closingFragment, state);
  };
}

export default class HookExtractor {
  componentList: ComponentNode[];
  stateList: StateNode[];
  propList: PropNode[];
  effectList: EffectNode[];
  asts: { source: string; ast: acorn.Node; defaultModule: string }[];

  constructor() {
    this.componentList = [];
    this.stateList = [];
    this.propList = [];
    this.effectList = [];
    this.asts = [];
  }

  public setProject(files: { source: string; content: string }[]) {
    console.info("setProject", files);
    for (const file of files) {
      if (!file.source.includes("node_modules")) {
        this.extractComponents(file.source, file.content);
      }
    }

    this.linkComponents();
    this.linkEffects();
  }

  public extractComponents(source: string, content: string) {
    console.info("extractComponents", source);

    const ast = this.parseJsFile(content);
    const defaultModule = this.extractDefaultModule(ast);
    console.log("extractComponents - ast", ast);
    this.asts.push({ source, ast, defaultModule });

    extend(walk.base);
    walk.fullAncestor<ComponentNode[]>(ast, (node, state, ancestor) => {
      if (!this.isComponent(node)) {
        return;
      }

      const name =
        node.type === "FunctionDeclaration"
          ? (node as acorn.FunctionDeclaration).id?.name
          : this.getArrowFunctionName(ancestor);

      if (!name || this.getComponentByName(name)) {
        return;
      }

      this.newComponentNode(name, source, ast, node);
    });

    console.info("extractComponents - All components", this.componentList);
  }

  public parseJsFile(code: string) {
    return espree.parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      ecmaFeatures: {
        jsx: true,
      },
    });
  }

  private extractDefaultModule(ast: acorn.Node) {
    let defaultModule = "";
    extend(walk.base);
    walk.simple(
      ast,
      {
        ExportDefaultDeclaration: (node) => {
          defaultModule = (node.declaration as acorn.Identifier).name;
        },
      },
      walk.base
    );

    return defaultModule;
  }

  private isComponent(node: acorn.Node) {
    if (
      node.type !== "FunctionDeclaration" &&
      node.type !== "ArrowFunctionExpression"
    ) {
      return false;
    }

    let isComponent = false;
    extend(walk.base);
    // FIXME: Return value check
    walk.full(node, (node) => {
      if (node.type === "JSXElement") {
        isComponent = true;
      }
    });

    return isComponent;
  }

  private getArrowFunctionName(ancestors: acorn.Node[]) {
    const parent = ancestors[ancestors.length - 2];
    if (parent && parent.type === "VariableDeclarator") {
      return ((parent as acorn.VariableDeclarator).id as acorn.Identifier).name;
    }
    return null;
  }

  private newComponentNode(
    name: string,
    path: string,
    fileAst: acorn.Node,
    node: acorn.Node
  ) {
    const newComponent = new ComponentNode(name, path, fileAst, node);
    newComponent.states = this.extractStates(node, newComponent);
    newComponent.props = this.extractProps(node, newComponent);

    this.componentList.push(newComponent);
    return newComponent;
  }

  private extractStates(astComponent: acorn.Node, component: ComponentNode) {
    console.log("extractStates", astComponent);
    const states: StateNode[] = [];
    const isCalleeUseState = (callee: acorn.Expression | acorn.Super) => {
      if (callee.type === "Identifier") {
        return (callee as acorn.Identifier).name === "useState";
      }

      if (callee.type === "MemberExpression") {
        return (callee.property as acorn.Identifier).name === "useState";
      }

      return false;
    };

    walk.fullAncestor(astComponent, (node, state, ancestor) => {
      if (node.type !== "CallExpression") {
        return;
      }

      if (!isCalleeUseState((node as acorn.CallExpression).callee)) {
        return;
      }

      console.log("CallExpression", node, ancestor.slice(0));
      const parent = ancestor[ancestor.length - 2];
      if (!parent || parent.type !== "VariableDeclarator") {
        return;
      }

      const returnValue = (parent as acorn.VariableDeclarator)
        .id as acorn.ArrayPattern;
      const name = (returnValue.elements[0] as acorn.Identifier).name;
      const setter = (returnValue.elements[1] as acorn.Identifier).name;
      states.push(this.newStateNode(component, name, setter));
    });

    return states;
  }

  private newStateNode(root: ComponentNode, name: string, setter: string) {
    const newState = new StateNode(name, root, setter);

    this.stateList.push(newState);
    return newState;
  }

  private extractProps(astComponent: acorn.Node, component: ComponentNode) {
    console.log("extractProps", astComponent);
    const props: PropNode[] = [];
    const params =
      astComponent.type === "ArrowFunctionExpression"
        ? (astComponent as acorn.ArrowFunctionExpression).params
        : (astComponent as acorn.FunctionDeclaration).params;

    if (params.length === 0) {
      return props;
    }

    if (params.length === 1 && params[0].type === "ObjectPattern") {
      for (const property of (params[0] as acorn.ObjectPattern).properties) {
        if (property.type === "Property") {
          const name = (property.key as acorn.Identifier).name;
          props.push(this.newPropNode(component, name));
        }
      }
    }

    return props;
  }

  private newPropNode(root: ComponentNode, name: string) {
    const newProp = new PropNode(name, root);
    this.propList.push(newProp);
    return newProp;
  }

  private extractImportedComponents(ast: acorn.Node, source: string) {
    const currentPath = source.split("/").slice(0, -1).join("/");
    console.info("getImportedComponents", currentPath);

    const importedComponents: string[] = [];
    walk.simple(ast, {
      ImportDeclaration: (node) => {
        const source = ((node.source as acorn.Literal).value as string) || "";

        walk.simple(node, {
          ImportSpecifier: (node) => {
            const name = (node.imported as acorn.Identifier).name;
            const component = this.getComponentByName(name);
            if (component) {
              importedComponents.push(component.id);
            }
          },
          ImportDefaultSpecifier: (node) => {
            const name = this.getDefaultModuleName(source, currentPath);
            const component = this.getComponentByName(name);
            if (component) {
              importedComponents.push(component.id);
            }
          },
        });
      },
    });

    return importedComponents;
  }

  private getDefaultModuleName(relativePath: string, currentPath: string) {
    const relativePathParts = relativePath.split("/");
    const currentPathParts = currentPath.split("/");
    let hierarchy = currentPathParts.length;
    let absolutePathIndex = -1;
    relativePathParts.forEach((part, i) => {
      if (part === "..") {
        absolutePathIndex = i;
        hierarchy--;
      } else if (part === ".") {
        absolutePathIndex = i;
      }
    });

    if (absolutePathIndex < 0) {
      return "";
    }

    const modifiedPath = currentPath
      .split("/")
      .slice(0, hierarchy)
      .concat(relativePathParts.slice(absolutePathIndex + 1))
      .join("/");
    console.log(
      "getDefaultModule",
      relativePath,
      modifiedPath,
      this.asts.find((ast) => ast.source.startsWith(modifiedPath))
    );

    return (
      this.asts.find((ast) => ast.source.startsWith(modifiedPath))
        ?.defaultModule || ""
    );
  }

  public linkComponents() {
    console.info("linkComponents");
    this.componentList.forEach((component) => {
      walk.full(component.node, (node) => {
        if (node.type !== "JSXElement") {
          return;
        }

        const openingElement = (node as any).openingElement;
        const target = this.getComponentByName(openingElement.name.name);

        if (!target) {
          return;
        }

        console.log("linkComponents", component, target, openingElement);
        this.findAttribute(target, openingElement);
        component.children.push(target);
      });

      const importedComponents = this.extractImportedComponents(
        component.fileAst,
        component.path
      );

      importedComponents.forEach((id) => {
        if (component.getChildById(id)) {
          return;
        }

        const target = this.getComponentById(id);
        if (!target) {
          return;
        }

        component.falseChildren.push(target);
      });
    });
  }

  private findAttribute(component: ComponentNode, openingElement: any) {
    console.info("findAttribute", component, openingElement);
    for (const attribute of openingElement.attributes) {
      if (attribute.type !== "JSXAttribute") {
        return;
      }

      const name = attribute.name.name;
      let target = component.getPropByName(name);

      if (!target) {
        console.log("Props target", component, attribute);
        target = this.newPropNode(component, name);
        component.props.push(target);
      }

      if (!target) {
        return;
      }

      const expression = attribute.value.expression;
      if (expression.type === "Identifier") {
        const name = (expression as acorn.Identifier).name;
        const reference = this.getStateByName(name) || this.getPropByName(name);
        if (reference) {
          target.references.push(reference.id);
        }
      } else if (expression.type === "MemberExpression") {
        const property = (expression as acorn.MemberExpression).property;
        walk.simple(
          property,
          {
            Identifier: (node, state) => {
              const name = node.name;
              const reference =
                this.getStateByName(name) || this.getPropByName(name);
              if (reference) {
                state.references.push(reference.id);
              }
            },
          },
          walk.base,
          target
        );
      }
    }
  }

  private findEffects(component: ComponentNode) {
    const astComponent = component.node;

    const effects: EffectNode[] = [];
    walk.full(astComponent, (node) => {
      if (node.type !== "CallExpression") {
        return;
      }

      const callee = (node as acorn.CallExpression).callee;
      if (callee.type !== "Identifier") {
        return;
      }

      const name = callee.name;
      if (name !== "useEffect") {
        return;
      }

      console.log("useEffect", node);
      const args = (node as acorn.CallExpression).arguments;
      const dependencieIds = args[1]
        ? (args[1] as acorn.ArrayExpression).elements
            .filter((element) => {
              const name = (element as acorn.Identifier).name;
              return (
                component.getStateByName(name) || component.getPropByName(name)
              );
            })
            .map((element) => {
              const name = (element as acorn.Identifier).name;
              return (component.getStateByName(name)?.id ||
                component.getPropByName(name)?.id) as string;
            })
        : [];

      console.log("dependency", dependencieIds);
      const effect = this.newEffectNode(
        component,
        name,
        args[0],
        dependencieIds
      );
      effects.push(effect);
    });

    return effects;
  }

  private newEffectNode(
    root: ComponentNode,
    name: string,
    body: acorn.Node,
    dependencyIds: string[]
  ) {
    const newEffect = new EffectNode(name, root, body, dependencyIds);
    this.effectList.push(newEffect);
    return newEffect;
  }

  public linkEffects() {
    this.componentList.forEach((component) => {
      const effects = this.findEffects(component);
      component.effects = effects;
    });
  }

  public print() {
    console.log("Components", this.componentList);
    console.log("States", this.stateList);
    console.log("Props", this.propList);
    console.log("Effects", this.effectList);

    this.componentList.forEach((component) => {
      console.log("Chidren count", component, this.countChidren(component));
    });
  }

  public getComponentById(id: string) {
    return this.componentList.find((component) => component.id === id);
  }

  public getStateById(id: string) {
    return this.stateList.find((state) => state.id === id);
  }

  public getPropById(id: string) {
    return this.propList.find((prop) => prop.id === id);
  }

  public getEffectById(id: string) {
    return this.effectList.find((effect) => effect.id === id);
  }

  public getComponentByName(name: string) {
    return this.componentList.find((component) => component.name === name);
  }

  public getStateByName(name: string) {
    return this.stateList.find((state) => state.name === name);
  }

  public getPropByName(name: string) {
    return this.propList.find((prop) => prop.name === name);
  }

  public getEffectByName(name: string) {
    return this.effectList.find((effect) => effect.name === name);
  }

  public toJson() {
    const componentList = {
      total: this.componentList.length,
      items: this.componentList.map((component) => {
        return {
          id: component.id,
          name: component.name,
          props: component.props.map((prop) => prop.id),
          states: component.states.map((state) => state.id),
          effects: component.effects.map((effect) => effect.id),
          children: component.children.map((child) => child.id),
        };
      }),
    };

    const stateList = {
      total: this.stateList.length,
      items: this.stateList.map((state) => {
        return {
          id: state.id,
          name: state.name,
          root: state.root.id,
        };
      }),
    };

    const effectList = {
      total: this.effectList.length,
      items: this.effectList.map((effect) => {
        return {
          id: effect.id,
          root: effect.root.id,
          dependencyIds: effect.dependencyIds,
        };
      }),
    };

    const propList = {
      total: this.propList.length,
      items: this.propList.map((prop) => {
        return {
          id: prop.id,
          name: prop.name,
          root: prop.root.id,
        };
      }),
    };

    const json = {
      componentList,
      stateList,
      effectList,
      propList,
    };

    return JSON.stringify(json, null, 2);
  }

  public visitChildren(
    component: ComponentNode,
    callback: (node: ComponentNode) => void
  ) {
    const visited: string[] = [];
    component.children.forEach((child) => {
      if (visited.includes(child.id)) {
        return;
      }

      visited.push(child.id);
      callback(child);
      this.visitChildren(child, callback);
    });
  }

  public countChidren(component: ComponentNode) {
    let count = 0;
    this.visitChildren(component, () => {
      count += 1;
    });

    return count;
  }
}
