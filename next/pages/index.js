import dynamic from "next/dynamic";
import { useQuery, useLazyQuery, gql } from "@apollo/client";
import { useState, useRef } from "react";
import _ from "lodash";

const mostRecentQuery = gql`
  {
    articles(options: { limit: 30, sort: { created: DESC } }) {
      __typename
      id
      title
      created
      url
      tags {
        __typename
        name
      }
      user {
        __typename
        username
        avatar
      }
    }
  }
`;

const moreArticlesQuery = gql`
  query articlesByTag($tag: String) {
    articles(
      where: { tags: { name: $tag } }
      options: { limit: 10, sort: { created: DESC } }
    ) {
      __typename
      id
      title
      created
      url
      tags {
        __typename
        name
      }
      user {
        __typename
        username
        avatar
      }
    }
  }
`;

const NoSSRForceGraph = dynamic(() => import("../lib/NoSSRForceGraph"), {
  ssr: false,
});

const formatData = (data) => {
  const nodes = [];
  const links = [];

  if (!data.articles) {
    return { nodes, links };
  }

  data.articles.forEach((a) => {
    nodes.push({
      id: a.id,
      url: a.url,
      __typename: a.__typename,
      title: a.title,
      x: a.x,
      y: a.y
    });

    nodes.push({
      id: a.user.username,
      avatar: a.user.avatar,
      __typename: a.user.__typename,
      x: a.x + 5,
      y: a.y + 5
    });

    links.push({
      source: a.user.username,
      target: a.id,
    });

    a.tags.forEach((t) => {
      nodes.push({
        id: t.name,
        __typename: t.__typename,
        x: a.x - 5,
        x: a.y - 5
      });

      links.push({
        source: a.id,
        target: t.name,
      });
    });
  });

  return {
    nodes: _.uniqBy(nodes, "id"),
    links,
  };
};

export default function Home() {
  const graphRef = useRef(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const { data } = useQuery(mostRecentQuery, {
    onCompleted: (data) => setGraphData(formatData(data)),
  });
  console.info("data: ",data)
  const [loadMoreArticles, { called, loading, data: newData }] = useLazyQuery(
    moreArticlesQuery,
    {
      onCompleted: (data) => {
        console.info("new data: ",data)
        const newSubgraph = formatData(data);
        setGraphData({
          nodes: _.uniqBy([...graphData.nodes, ...newSubgraph.nodes], "id"),
          links: [...graphData.links, ...newSubgraph.links],
        });
      },
    }
  );

  const updateGraphData = (newData) => {
    console.info("before data: ", graphData.nodes)
    const newSubgraph = formatData(newData);
    setGraphData({
      nodes: _.uniqBy([...graphData.nodes, ...newSubgraph.nodes], "id"),
      links: [...graphData.links, ...newSubgraph.links],
    });
    console.info("after data: ", graphData.nodes)
  };

  const rename = (nodeOrLink, type) => {
    console.info("rename", nodeOrLink, type);
    const value = prompt('Name this ' + type + ':', nodeOrLink.title);
    if (!value) {
      return;
    }
    nodeOrLink.title = value;
    updateGraphData(nodeOrLink);
  };

  return (
    <NoSSRForceGraph
      graphRef={graphRef}
      nodeAutoColorBy={"__typename"}
      nodeLabel={"id"}
      graphData={graphData}
      onNodeClick={(node, event) => {
        console.log("click node: ", node);
        rename(node, 'node')
        if (node.__typename === "Tag") {
          loadMoreArticles({ variables: { tag: node.id } });
        } else if (node.__typename === "Article") {
          window.open(node.url, "_blank");
        }
      }}
      nodeCanvasObject={(node, ctx, globalScale) => {
        if (node.__typename === "Tag" || node.__typename === "Article") {
          const label = node.title || node.id;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(
            (n) => n + fontSize * 0.2
          );
          ctx.fillStyle = `rgba(255, 255, 255, 0.8)`;
          ctx.fillRect(
            node.x - bckgDimensions[0] / 2,
            node.y - bckgDimensions[1] / 2,
            ...bckgDimensions
          );
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = node.color;
          ctx.fillText(label, node.x, node.y);

          node.__bckgDimensions = bckgDimensions;
        } else if (node.__typename === "User") {
          // TODO: draw image
          const size = 12;
          const img = new Image();
          img.src = node.avatar;
          ctx.drawImage(img, node.x - size / 2, node.y - size / 2, size, size);
        }
      }}
      nodePointerAreaPaint={(node, color, ctx) => {
        ctx.fillStyle = color;
        const bckgDimensions = node.__bckgDimensions;
        bckgDimensions &&
          ctx.fillRect(
            node.x - bckgDimensions[0] / 2,
            node.y - bckgDimensions[1] / 2,
            ...bckgDimensions
          );
      }}
      onBackgroundClick={(event) => {
        console.info("bg click", event)
        const coords = graphRef.current.screen2GraphCoords(event.layerX, event.layerY)
        console.info("coords", coords)
        const random_article = Math.floor(Math.random() * 100);
        const random_user = Math.floor(Math.random() * 100);
        const random_tag = Math.floor(Math.random() * 100);
        const newData = {
          articles: [
            {
              id: `add_article${random_article}`,
              url: "https://teamaround.notion.site/How-To-Use-Workspaces-Beta-e280bdbbabfc4b7aa5db2f3e74d83e10",
              __typename: "Article",
              title: `sample_article${random_article}`,
              x: coords.x,
              y: coords.y,
              user: {
                username: `sample_user${random_user}`,
                avatar: "https://ca.slack-edge.com/T01KP8N13EF-U01L1M32R7T-d601688eb306-512",
                __typename: "User"
              },
              tags: [
                {
                  name: `sample_tag${random_tag}`,
                  __typename: "Tag"
                }
              ]
            }
          ],
        }
        const newSubgraph = formatData(newData);
        setGraphData({
          nodes: _.uniqBy([...graphData.nodes, ...newSubgraph.nodes], "id"),
          links: [...graphData.links, ...newSubgraph.links],
        });
      }}
    />
  );
}
