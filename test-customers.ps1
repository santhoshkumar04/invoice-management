
$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:4000"

$Results = [System.Collections.Generic.List[object]]::new()

function Add-TestResult {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Details = ""
    )

    $Results.Add([PSCustomObject]@{
        Test    = $Name
        Result  = if ($Passed) { "PASS" } else { "FAIL" }
        Details = $Details
    })

    if ($Passed) {
        Write-Host "[PASS] $Name" -ForegroundColor Green
    }
    else {
        Write-Host "[FAIL] $Name - $Details" -ForegroundColor Red
    }
}

function Get-PlainPassword {
    param([string]$Prompt)

    $secure = Read-Host $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)

    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Invoke-TestRequest {
    param(
        [string]$Method,
        [string]$Path,
        [string]$Token,
        [object]$Body
    )

    $headers = @{}

    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }

    $parameters = @{
        Uri         = "$BaseUrl$Path"
        Method      = $Method
        Headers     = $headers
        ContentType = "application/json"
    }

    if ($null -ne $Body) {
        $parameters.Body = $Body | ConvertTo-Json -Depth 10
    }

    try {
        $response = Invoke-RestMethod @parameters

        return [PSCustomObject]@{
            Status = 200
            Data   = $response
        }
    }
    catch {
        $status = 0
        $responseBody = $null

        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode

            try {
                $stream = $_.Exception.Response.GetResponseStream()

                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $responseBody = $reader.ReadToEnd()
                    $reader.Dispose()
                }
            }
            catch {}
        }

        return [PSCustomObject]@{
            Status = $status
            Data   = $responseBody
        }
    }
}

Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host " CUSTOMER API INTEGRATION TESTS" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# 1. Unauthenticated request

$unauth = Invoke-TestRequest `
    -Method GET `
    -Path "/customers" `
    -Token "" `
    -Body $null

Add-TestResult `
    -Name "Unauthenticated customer access returns 401" `
    -Passed ($unauth.Status -eq 401) `
    -Details "HTTP $($unauth.Status)"

# 2. Admin login

$adminEmail = Read-Host "Enter Admin email"
$adminPassword = Get-PlainPassword "Enter Admin password"

$adminLogin = Invoke-TestRequest `
    -Method POST `
    -Path "/auth/login" `
    -Token "" `
    -Body @{
        email    = $adminEmail
        password = $adminPassword
    }

$adminToken = $null

if (
    $adminLogin.Status -eq 200 -and
    $adminLogin.Data.success -eq $true
) {
    $adminToken = $adminLogin.Data.data.accessToken
}

Add-TestResult `
    -Name "Admin login" `
    -Passed ([bool]$adminToken)

$adminPassword = $null

if (-not $adminToken) {
    Write-Host "`nAdmin login failed. Stopping tests." -ForegroundColor Red
    return
}

if ($adminLogin.Data.data.user.role -ne "admin") {
    Write-Host "The supplied account is not an Admin." -ForegroundColor Red
    return
}

# 3. Create a test customer

$unique = [Guid]::NewGuid().ToString("N").Substring(0, 8)

$customerBody = @{
    customerName  = "API Test Customer $unique"
    companyName   = "Integration Test Company"
    contactPerson = "Test Contact"
    email         = "customer-$unique@example.com"
    mobile        = "9876543210"
    addressLine1  = "Test Address"
    city          = "Chennai"
    state         = "Tamil Nadu"
    stateCode     = "33"
    postalCode    = "600001"
    country       = "India"
    gstin         = "33ABCDE1234F1Z5"
    pan           = "ABCDE1234F"
    vendorCode    = "TEST-$unique"
    notes         = "Created by customer integration test"
}

$created = Invoke-TestRequest `
    -Method POST `
    -Path "/customers" `
    -Token $adminToken `
    -Body $customerBody

$customerId = $null

if (
    $created.Status -eq 200 -or
    $created.Status -eq 201
) {
    if ($created.Data.success) {
        $customerId = $created.Data.data.id
    }
}

Add-TestResult `
    -Name "Admin creates customer" `
    -Passed ([bool]$customerId) `
    -Details "HTTP $($created.Status)"

if (-not $customerId) {
    Write-Host "`nCustomer creation failed. Inspect API terminal logs." -ForegroundColor Red
    $Results | Format-Table -AutoSize
    return
}

Write-Host "`nTest customer ID: $customerId" -ForegroundColor Cyan

# 4. Admin lists active customers

$adminList = Invoke-TestRequest `
    -Method GET `
    -Path "/customers?status=active&limit=100" `
    -Token $adminToken `
    -Body $null

$foundInList = $false

if ($adminList.Data.data.items) {
    $foundInList = @(
        $adminList.Data.data.items |
        Where-Object { $_.id -eq $customerId }
    ).Count -gt 0
}

Add-TestResult `
    -Name "Admin lists active customers" `
    -Passed ($adminList.Status -eq 200 -and $foundInList)

# 5. Admin gets customer details

$adminDetail = Invoke-TestRequest `
    -Method GET `
    -Path "/customers/$customerId" `
    -Token $adminToken `
    -Body $null

Add-TestResult `
    -Name "Admin views customer details" `
    -Passed (
        $adminDetail.Status -eq 200 -and
        $adminDetail.Data.data.id -eq $customerId
    )

# 6. Admin updates customer

$updateBody = @{
    customerName = "Updated API Customer $unique"
    companyName  = "Updated Integration Company"
    mobile       = ""
}

$updated = Invoke-TestRequest `
    -Method PATCH `
    -Path "/customers/$customerId" `
    -Token $adminToken `
    -Body $updateBody

Add-TestResult `
    -Name "Admin updates customer details" `
    -Passed (
        $updated.Status -eq 200 -and
        $updated.Data.data.customerName -eq "Updated API Customer $unique"
    )

Add-TestResult `
    -Name "Empty mobile is normalized to null" `
    -Passed (
        $updated.Status -eq 200 -and
        $null -eq $updated.Data.data.mobile
    )

# 7. Technician login

$technicianEmail = Read-Host "`nEnter Technician email"
$technicianPassword = Get-PlainPassword "Enter Technician password"

$technicianLogin = Invoke-TestRequest `
    -Method POST `
    -Path "/auth/login" `
    -Token "" `
    -Body @{
        email    = $technicianEmail
        password = $technicianPassword
    }

$technicianToken = $null

if (
    $technicianLogin.Status -eq 200 -and
    $technicianLogin.Data.success -eq $true
) {
    $technicianToken = $technicianLogin.Data.data.accessToken
}

Add-TestResult `
    -Name "Technician login" `
    -Passed ([bool]$technicianToken)

$technicianPassword = $null

if (-not $technicianToken) {
    Write-Host "`nTechnician login failed. Stopping technician tests." -ForegroundColor Red
    $Results | Format-Table -AutoSize
    return
}

if ($technicianLogin.Data.data.user.role -ne "technician") {
    Write-Host "The supplied account is not a Technician." -ForegroundColor Red
    return
}

# 8. Technician lists active customers

$technicianList = Invoke-TestRequest `
    -Method GET `
    -Path "/customers?status=active&limit=100" `
    -Token $technicianToken `
    -Body $null

$technicianFound = $false

if ($technicianList.Data.data.items) {
    $technicianFound = @(
        $technicianList.Data.data.items |
        Where-Object { $_.id -eq $customerId }
    ).Count -gt 0
}

Add-TestResult `
    -Name "Technician lists active customers" `
    -Passed (
        $technicianList.Status -eq 200 -and
        $technicianFound
    )

# 9. Technician views customer

$technicianDetail = Invoke-TestRequest `
    -Method GET `
    -Path "/customers/$customerId" `
    -Token $technicianToken `
    -Body $null

Add-TestResult `
    -Name "Technician views active customer" `
    -Passed (
        $technicianDetail.Status -eq 200 -and
        $technicianDetail.Data.data.id -eq $customerId
    )

# 10. Technician cannot create customers

$technicianCreate = Invoke-TestRequest `
    -Method POST `
    -Path "/customers" `
    -Token $technicianToken `
    -Body @{
        customerName = "Unauthorized Customer"
    }

Add-TestResult `
    -Name "Technician cannot create customers" `
    -Passed ($technicianCreate.Status -eq 403)

# 11. Technician cannot edit customers

$technicianUpdate = Invoke-TestRequest `
    -Method PATCH `
    -Path "/customers/$customerId" `
    -Token $technicianToken `
    -Body @{
        customerName = "Unauthorized Update"
    }

Add-TestResult `
    -Name "Technician cannot edit customers" `
    -Passed ($technicianUpdate.Status -eq 403)

# 12. Technician cannot deactivate customers

$technicianStatus = Invoke-TestRequest `
    -Method PATCH `
    -Path "/customers/$customerId/status" `
    -Token $technicianToken `
    -Body @{
        isActive = $false
    }

Add-TestResult `
    -Name "Technician cannot change customer status" `
    -Passed ($technicianStatus.Status -eq 403)

# 13. Admin deactivates customer

$deactivated = Invoke-TestRequest `
    -Method PATCH `
    -Path "/customers/$customerId/status" `
    -Token $adminToken `
    -Body @{
        isActive = $false
    }

Add-TestResult `
    -Name "Admin deactivates customer" `
    -Passed (
        $deactivated.Status -eq 200 -and
        $deactivated.Data.data.isActive -eq $false
    )

# 14. Technician cannot view inactive customer

$inactiveDetail = Invoke-TestRequest `
    -Method GET `
    -Path "/customers/$customerId" `
    -Token $technicianToken `
    -Body $null

Add-TestResult `
    -Name "Technician cannot view inactive customer" `
    -Passed ($inactiveDetail.Status -eq 404)

# 15. Technician cannot list inactive customer

$inactiveList = Invoke-TestRequest `
    -Method GET `
    -Path "/customers?status=inactive&limit=100" `
    -Token $technicianToken `
    -Body $null

$inactiveVisibleToTechnician = $false

if ($inactiveList.Data.data.items) {
    $inactiveVisibleToTechnician = @(
        $inactiveList.Data.data.items |
        Where-Object { $_.id -eq $customerId }
    ).Count -gt 0
}

Add-TestResult `
    -Name "Technician cannot list inactive customers" `
    -Passed (
        $inactiveList.Status -eq 200 -and
        -not $inactiveVisibleToTechnician
    )

# 16. Admin lists inactive customers

$adminInactive = Invoke-TestRequest `
    -Method GET `
    -Path "/customers?status=inactive&limit=100" `
    -Token $adminToken `
    -Body $null

$adminFoundInactive = $false

if ($adminInactive.Data.data.items) {
    $adminFoundInactive = @(
        $adminInactive.Data.data.items |
        Where-Object { $_.id -eq $customerId }
    ).Count -gt 0
}

Add-TestResult `
    -Name "Admin can view inactive customers" `
    -Passed (
        $adminInactive.Status -eq 200 -and
        $adminFoundInactive
    )

# 17. Admin reactivates customer

$reactivated = Invoke-TestRequest `
    -Method PATCH `
    -Path "/customers/$customerId/status" `
    -Token $adminToken `
    -Body @{
        isActive = $true
    }

Add-TestResult `
    -Name "Admin reactivates customer" `
    -Passed (
        $reactivated.Status -eq 200 -and
        $reactivated.Data.data.isActive -eq $true
    )

# 18. Technician can view reactivated customer

$reactivatedDetail = Invoke-TestRequest `
    -Method GET `
    -Path "/customers/$customerId" `
    -Token $technicianToken `
    -Body $null

Add-TestResult `
    -Name "Technician can view reactivated customer" `
    -Passed (
        $reactivatedDetail.Status -eq 200 -and
        $reactivatedDetail.Data.data.isActive -eq $true
    )

# Final report

Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host " CUSTOMER API TEST SUMMARY" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$Results | Format-Table -AutoSize

$passedCount = @($Results | Where-Object Result -eq "PASS").Count
$failedCount = @($Results | Where-Object Result -eq "FAIL").Count

Write-Host "Passed: $passedCount" -ForegroundColor Green
Write-Host "Failed: $failedCount" -ForegroundColor $(if ($failedCount -eq 0) { "Green" } else { "Red" })

Write-Host "`nTest customer ID: $customerId" -ForegroundColor Cyan
Write-Host "The test customer has been reactivated and retained." -ForegroundColor Yellow

Write-Host "`nIntegration tests completed." -ForegroundColor Cyan
