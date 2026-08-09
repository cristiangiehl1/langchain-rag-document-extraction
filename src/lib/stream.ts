// Wire protocol for the streaming chat endpoint.
// The response body is: <metadata JSON> + META_DELIM + <answer tokens...>
// If generation fails mid-stream, ERROR_DELIM + <message> is appended.
export const META_DELIM = "\n__ANSWER__\n";
export const ERROR_DELIM = "\n__ERROR__\n";
