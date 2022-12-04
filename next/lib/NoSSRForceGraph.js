import ForceGraph2D from 'react-force-graph-2d'
export default function NoSSRForceGraph({ graphRef, ...props }) {
  return <ForceGraph2D {...props} ref={graphRef} />
}