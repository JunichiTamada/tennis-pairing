const HON_SUFFIXES = ["さん","様","くん","君","ちゃん","氏"];

export function withHonorific(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return "";
  if (HON_SUFFIXES.some(sfx => name.endsWith(sfx))) return name;
  return `${name}さん`;
}

// デフォルトも出しておくと、どちらの書き方でもOK
export default withHonorific;
