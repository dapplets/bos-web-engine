import type { VNode } from 'preact';

import {
  CallbackRequest,
  InitContainerParams,
  Node,
  Props,
  RenderComponentCallback,
} from './types';

export function initContainer({
  containerMethods: {
    buildEventHandler,
    buildRequest,
    buildSafeProxy,
    buildUseComponentCallback,
    composeMessagingMethods,
    composeSerializationMethods,
    dispatchRenderEvent,
    invokeCallback,
    invokeComponentCallback,
    isMatchingProps,
    preactify,
    renderContainerComponent,
  },
  context: {
    Component,
    componentId,
    componentPropsJson,
    ContainerComponent,
    createElement,
    parentContainerId,
    preactHooksDiffed,
    preactRootComponentName,
    render,
    trust,
    updateContainerProps,
  },
}: InitContainerParams) {
  const callbacks: { [key: string]: Function } = {};
  const requests: { [key: string]: CallbackRequest } = {};

  const {
    postCallbackInvocationMessage,
    postCallbackResponseMessage,
    postComponentRenderMessage,
  } = composeMessagingMethods();

  const { deserializeProps, serializeArgs, serializeNode, serializeProps } =
    composeSerializationMethods({
      buildRequest,
      callbacks,
      parentContainerId,
      postCallbackInvocationMessage,
      preactRootComponentName,
      requests,
    });

  const renderComponent: RenderComponentCallback = () =>
    renderContainerComponent({
      ContainerComponent,
      componentId,
      render,
      createElement,
    });

  // cache previous renders
  const nodeRenders = new Map<string, string>();

  const diffComponent = (vnode: VNode) => {
    // TODO this handler will fire for every descendant node rendered,
    //  could be a good way to optimize renders within a container without
    //  re-rendering the entire thing
    const [containerComponent] = (vnode.props?.children as any[]) || [];
    const isRootComponent =
      typeof vnode.type === 'function' &&
      vnode.type?.name === preactRootComponentName;

    if (containerComponent && isRootComponent) {
      dispatchRenderEvent({
        callbacks,
        componentId,
        node: containerComponent(),
        nodeRenders,
        postComponentRenderMessage,
        preactRootComponentName,
        serializeNode,
        serializeProps,
        trust,
      });
    }
    preactHooksDiffed?.(vnode);
  };

  const dispatchRender = (vnode: Node) => {
    dispatchRenderEvent({
      callbacks,
      componentId,
      node: vnode,
      nodeRenders,
      postComponentRenderMessage,
      preactRootComponentName,
      serializeNode,
      serializeProps,
      trust,
    });
  };

  const processEvent = buildEventHandler({
    buildRequest,
    callbacks,
    componentId,
    deserializeProps,
    invokeCallback,
    invokeComponentCallback,
    parentContainerId,
    postCallbackInvocationMessage,
    postCallbackResponseMessage,
    renderDom: (node: Node) => preactify({ node, createElement, Component }),
    requests,
    serializeArgs,
    serializeNode,
    updateProps: (newProps) =>
      updateContainerProps((props: Props) => {
        /* `props` is actually a proxy */
        if (isMatchingProps({ ...props }, newProps)) {
          return props;
        }

        return buildSafeProxy({
          componentId,
          props: {
            ...props,
            ...newProps,
          },
        });
      }),
  });

  const props = buildSafeProxy({
    componentId,
    props: deserializeProps({
      componentId,
      props: componentPropsJson,
    }),
  });

  return {
    diffComponent,
    dispatchRender,
    processEvent,
    props,
    renderComponent,
    useComponentCallback: buildUseComponentCallback(renderComponent),
  };
}
