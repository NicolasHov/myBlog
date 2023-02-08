---
layout: blog-post.njk
bodyClass: "blog-post"

seo:
  title: .
  description: "As a pre-christmas personal gift, I have just purchased a ThinkPad x270 laptop from 2000 and installed NixOs on it. I found out it cames with a fingerprint sensor. But I have no clues on how to make it works. This is my adventures discovering NixOS."
  socialImage: "https://res.cloudinary.com/glinkaco/image/upload/v1646849499/tgc2022/social_yitz6j.png"
  canonicalOverwrite: ""

blogTitle: "_NixOS quest_ : trying to make my fingerprint sensor works."
date: "2023-02-08T10:45:10Z"
author: "Nicolas Hovart"
image: "/assets/images/blog-images/thinkpad_x270.jpg"
featuredBlogpost: true
featuredBlogpostOrder: 1
excerpt: |-
  As a pre-christmas personal gift, I have just purchased a ThinkPad x270 laptop from 2000 and installed NixOs on it. I found out it cames with a fingerprint sensor. But I have no clues on how to make it works. This is my adventures discovering NixOS.
---


![](/assets/images/blog-images/crossing.jpg#full-width)

## Configure NixOS on my ThinkPad x270 : 

### Step 0 - I installed NixOs on my machine and add some configuration...
More details may come later in an other post. [(Laters, gators)](https://www.cbr.com/moon-knight-steven-grant-lator-gators-marc-spector-theory/)

For now, here my config https://github.com/NicolasHov/nixfiles with nixos-unstable

NB : you may just notice that I added the line `<nixos-hardware/lenovo/thinkpad/x270>` in my configuration.nix file)

### Step 1 - ...then I looked for the good fingerprint sensor's driver, and I put my finger on something (sic)
As there were mostly doc for Ubuntu users and not (yet) Nix users, I slowly realize that it would be the beginning of a long quest to find the right driver for my fingerprint sensor. And that would includes tears and blood (almost)

#### I found this Linux packages : fprintd

>fprintd is a daemon that provides fingerprint scanning functionality over D-Bus. This is the software developers will want to integrate with to add fingerprint authentication to OSes, desktop environments and applications.

**But how to install it with NixOs ?**

* found first this thread that added the driver vfs0090 (or the goodix one ) https://discourse.nixos.org/t/how-to-use-fingerprint-unlocking-how-to-set-up-fprintd-english/21901/2 
```
   # fingerprint reader: login and unlock with fingerprint (if you add one with `fprintd-enroll`)
  services.fprintd.tod.enable = true;
  services.fprintd.tod.driver = pkgs.libfprint-2-tod1-vfs0090;
  services.fprintd.enable = true;
  
  # I also add those lines which seems to solve some bugs
  systemd.services.fprintd = {
     wantedBy = [ "multi-user.target" ];
     serviceConfig.Type = "simple"; #change the service to start on boot (quicker)
   };
 
  ```
It  
I then checked in gnome settings if it added the fingerprint option in the user password menu but it did not show me any changes yet...(I learned later that I could see it in a more easier way typing the command `fprint-enroll`)

* I then added the nix package `lsusb` to my configand use it to show me my hardware informations, especially the sensor one.

Found out it was the 'Validity' sensor:
`Bus 001 Device 004: ID 138a:0097 Validity Sensors, Inc. 
`

* As I was not inspired, I found another post on nixos discourse which seems to be close. It talks about PAM (Privileged Access Management):
https://discourse.nixos.org/t/strange-lock-screen-behaviour-with-fprintd-enabled/10248
and I added those lines: 
```
 security.pam.services.login.fprintAuth = true;
 security.pam.services.xscreensaver.fprintAuth = true; # similarly for other PAM providers
```
but my sensor was still not recognize yet, it was too early to care about permissions 

**I had to look further and find if a driver existed for this Validity sensor I owned**

* I found out there's a python driver for validity's sensors on Ubuntu forums. The repo is https://github.com/uunicorn/python-validity 

**But how to use this driver with NixOs ? It was not in NixOs packages**

* gladly this question on the forum nixos discourse was exactly my point: there were no package for this driver: https://discourse.nixos.org/t/thinkpad-t480-fingerprint-reader-support/17448/3 but it was not the same sensor. Though it helped me a lot knowing that I was not the only one struggling with my fingerprint sensor :)

* I even had a look at the official validity forum, but the only person who asked about a nix package for it did not have an answer, and it was around 2012: https://gitter.im/Validity90/Lobby?at=5caf58edf851ee043d9d85d3

### Step 3 - Trying to write a NixOS package

**yes**

My friend Yvan Sraka was not far away and kindly tried to write the nixpkgs for python-validity driver. 

Here some of the resources he used:
- https://nixos.org/manual/nixpkgs/stable/#chap-quick-start
- https://github.com/on-nix/python 
- https://ryantm.github.io/nixpkgs/languages-frameworks/python/
- ...TODO

and voila, the default.nix file he added to the python-validity folder:
```
{ lib, python3Packages }:
with python3Packages;
buildPythonApplication {
  pname = "python-validity";
  version = "0.12";

  propagatedBuildInputs = [ cryptography pyusb pyyaml ];

  driverPath = /usr/share/python-validity/6_07f_lenovo_mis_qm.xpfwext;

  src = ./.;
}
```
We then add this in configuration.nix after the lines we previously talked about
```services.fprintd.tod.driver = pkgs.callPackage ./python-validity { };```

Sadly we end up getting this error trying the command `fprint-enroll`
```Impossible to enroll: GDBus.Error:net.reactivated.Fprint.Error.NoSuchDevice: No devices available```


### Step 4 - my first answer on an issue in Github and the first step to success

This (cool) guy, Anton, answered my issue here https://github.com/NixOS/nixos-hardware/issues/521 

He had successsfully creates some Nix packages based on the AUR packages python-validity, open-fprintd and fprintd-clients). The good idea was using open-fprintd rather than fprintd.
Some parts of his packages are still to be adapted from AUR yet : account management, authentification, password or session management


At least I can know enroll an user and even verify if he match from the console !! What a day !

But there's still some problems to solve as I can't authentify myself when loading, and it seems to have a trouble when session suspends/resumes.

### Step 5 - PAM management 

this code need to be adated in nix:

```

  # Account management.
   account sufficient pam_unix.so
  
  # Authentication management.
   auth sufficient pam_unix.so   likeauth try_first_pass nullok
   auth sufficient ${fprintd-clients}/lib/security/pam_fprintd.so
   auth required pam_deny.so
  
  # Password management.
   password sufficient pam_unix.so nullok sha512
  
  # Session management.
   session required pam_env.so conffile=/etc/pam/environment readenv=0
   session required pam_unix.so
```

### Step 6 - Bug when session wake up from sleep
The `open-fprintd-resume` or `open-fprintd-suspend` services are included in `open-fprintd` repo but it seems that they don't work properly with NixOS...

### 

