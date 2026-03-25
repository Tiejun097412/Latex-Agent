$body = @'
{
  "id": "verify-compile",
  "owner": "guest",
  "compiler": "xelatex",
  "content": "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\nHello\\[x^2+y^2=1\\]\n\\end{document}",
  "images": []
}
'@

try {
  $response = Invoke-RestMethod -Uri 'http://localhost:8080/api/projects/compile' -Method Post -ContentType 'application/json' -Body $body
  [PSCustomObject]@{
    ok = $response.ok
    compiler = $response.compiler
    pdfLength = $response.pdfBase64.Length
  } | ConvertTo-Json -Depth 3
} catch {
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader.BaseStream.Position = 0
    $reader.DiscardBufferedData()
    $reader.ReadToEnd()
  } else {
    throw
  }
}
